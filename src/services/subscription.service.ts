import "server-only";
import { redis } from "@/lib/redis";
import { createSupabaseServer } from "@/lib/supabase/server";
import { SubscriptionItem } from "@/types";

const getCacheKey = (userId: string) => `subs:user:${userId}`;
const CACHE_TTL = 2592000; // 30 ngày (tính bằng giây)

export const SubscriptionService = {
  /**
   * 1. Lấy danh sách phim theo dõi (Ưu tiên Cache -> DB)
   */
  getList: async (
    userId: string,
    limit: number = 12,
  ): Promise<SubscriptionItem[]> => {
    const key = getCacheKey(userId);
    let subsList: SubscriptionItem[] = [];

    try {
      // BƯỚC 1: Lấy từ Redis Hash
      if (redis) {
        const cachedData = await redis.hgetall<Record<string, string>>(key);

        if (cachedData && Object.keys(cachedData).length > 0) {
          subsList = Object.values(cachedData).map(
            (val: string | SubscriptionItem) =>
              typeof val === "string"
                ? (JSON.parse(val) as SubscriptionItem)
                : val,
          );
        }
      }

      // BƯỚC 2: Cache Miss -> Query DB
      if (subsList.length === 0) {
        const supabase = await createSupabaseServer();
        const { data, error } = await supabase
          .from("user_subscriptions")
          .select("*")
          .eq("user_id", userId)
          .order("has_new_episode", { ascending: false })
          .order("updated_at", { ascending: false })
          .limit(limit);

        if (error) throw error;

        if (data && data.length > 0) {
          subsList = data as SubscriptionItem[];

          // BƯỚC 3: Backfill (Nạp lại) vào Redis
          if (redis) {
            const pipeline = redis.pipeline();
            subsList.forEach((item) => {
              pipeline.hset(key, { [item.movie_slug]: JSON.stringify(item) });
            });
            pipeline.expire(key, CACHE_TTL);
            await pipeline.exec();
          }
        }
      }

      // BƯỚC 4: Sắp xếp kết quả trả về cho Frontend
      return subsList
        .sort((a, b) => {
          if (a.has_new_episode !== b.has_new_episode)
            return a.has_new_episode ? -1 : 1;
          return (
            new Date(b.updated_at || 0).getTime() -
            new Date(a.updated_at || 0).getTime()
          );
        })
        .slice(0, limit);
    } catch (error) {
      console.error("[SubscriptionService.getList] Error:", error);
      return [];
    }
  },

  /**
   * 2. Kiểm tra trạng thái theo dõi (Nhanh, dùng cho trang chi tiết phim)
   */
  checkStatus: async (userId: string, movieSlug: string): Promise<boolean> => {
    const key = getCacheKey(userId);

    // Check Redis (O(1))
    if (redis) {
      const cached = await redis.hget(key, movieSlug);
      if (cached) return true;
    }

    // Cache Miss -> Check DB
    const supabase = await createSupabaseServer();
    const { data } = await supabase
      .from("user_subscriptions")
      .select("id")
      .eq("user_id", userId)
      .eq("movie_slug", movieSlug)
      .maybeSingle();

    return !!data;
  },

  /**
   * 3. Thêm phim vào danh sách theo dõi
   */
  add: async (userId: string, item: SubscriptionItem) => {
    const supabase = await createSupabaseServer();
    const newItem = {
      ...item,
      user_id: userId,
      updated_at: new Date().toISOString(),
    };

    // 1. Lưu DB
    const { error } = await supabase
      .from("user_subscriptions")
      .upsert(newItem, { onConflict: "user_id,movie_slug" });

    if (error) throw error;

    // 2. Cập nhật Redis ngay lập tức (Write-through Cache)
    if (redis) {
      const key = getCacheKey(userId);
      await redis.hset(key, { [item.movie_slug]: JSON.stringify(newItem) });
      await redis.expire(key, CACHE_TTL);
    }

    return newItem;
  },

  /**
   * 4. Xóa phim khỏi danh sách theo dõi
   */
  remove: async (userId: string, movieSlug: string) => {
    const supabase = await createSupabaseServer();

    // 1. Xóa DB
    const { error } = await supabase
      .from("user_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("movie_slug", movieSlug);

    if (error) throw error;

    // 2. Xóa khỏi Redis
    if (redis) {
      await redis.hdel(getCacheKey(userId), movieSlug);
    }
  },

  /**
   * 5. Xóa Badge (Chấm đỏ) khi user xem tập mới
   */
  clearBadge: async (userId: string, movieSlug: string) => {
    const supabase = await createSupabaseServer();

    // 1. Cập nhật DB
    const { data, error } = await supabase
      .from("user_subscriptions")
      .update({ has_new_episode: false })
      .eq("user_id", userId)
      .eq("movie_slug", movieSlug)
      .select();

    if (error) throw error;

    // 2. Cập nhật Redis & Xóa Cache Phim (Cache Invalidation)
    if (redis) {
      // Cập nhật lại item trong Hash (đã set has_new_episode = false)
      if (data && data.length > 0) {
        await redis.hset(getCacheKey(userId), {
          [movieSlug]: JSON.stringify(data[0]),
        });
      }

      // XÓA CACHE CHI TIẾT PHIM ĐỂ ÉP FETCH TẬP MỚI TỪ OPHIM
      await redis.del(`detail:${movieSlug}`);
    }
  },

  /**
   * 6. Đồng bộ LocalStorage (Khi user Guest vừa đăng nhập)
   */
  syncLocal: async (userId: string, localSubs: SubscriptionItem[]) => {
    if (!localSubs || localSubs.length === 0) return;

    const supabase = await createSupabaseServer();

    // 1. Lấy dữ liệu DB hiện tại
    const { data: dbSubs } = await supabase
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", userId);

    const dbMap = new Map(dbSubs?.map((s) => [s.movie_slug, s]));

    // 2. Gộp dữ liệu
    const upsertData = localSubs.map((localItem) => {
      const dbItem = dbMap.get(localItem.movie_slug);
      return {
        user_id: userId,
        movie_slug: localItem.movie_slug,
        movie_name: localItem.movie_name,
        movie_poster: localItem.movie_poster,
        movie_status: localItem.movie_status || "ongoing",
        last_known_episode_slug:
          localItem.last_known_episode_slug || dbItem?.last_known_episode_slug,
        // Nếu Server đang có tập mới, hoặc Client báo có tập mới -> Giữ true
        has_new_episode:
          dbItem?.has_new_episode || localItem.has_new_episode || false,
        updated_at: new Date().toISOString(),
      };
    });

    // 3. Bulk Upsert DB
    const { error } = await supabase
      .from("user_subscriptions")
      .upsert(upsertData, { onConflict: "user_id,movie_slug" });

    if (error) throw error;

    // 4. Xóa sạch Redis Cache để lần truy cập tiếp theo tự động Backfill dữ liệu đã Merge
    if (redis) {
      await redis.del(getCacheKey(userId));
    }
  },
};
