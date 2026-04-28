import "server-only";

import { redis } from "@/lib/redis";
import { createSupabaseServer } from "@/lib/supabase/server";
import { SubscriptionItem } from "@/types";

const getSubsKey = (userId: string) => `subs:user:${userId}`;
const getStatsKey = (userId: string) => `subs:stats:user:${userId}`;
const CACHE_TTL = 2592000; // 30 ngày

export const SubscriptionService = {
  /**
   * 1. HỦY CACHE TRANG ĐẦU
   */
  invalidateTopCache: async (userId: string) => {
    if (!redis) return;
    const key = getSubsKey(userId);
    const pipeline = redis.pipeline();
    pipeline.del(`${key}:top:all`);
    pipeline.del(`${key}:top:new`);
    await pipeline.exec();
  },

  /**
   * 2. SỬA CACHE TRANG ĐẦU TẠI CHỖ (Nhanh như chớp)
   */
  mutateTopCache: async (
    userId: string,
    updatedItem: SubscriptionItem,
    action: "ADD" | "UPDATE" | "DELETE",
  ) => {
    if (!redis) return;
    const key = getSubsKey(userId);

    const updateSpecificCache = async (
      filter: string,
      shouldInclude: boolean,
    ) => {
      const cacheKey = `${key}:top:${filter}`;
      const cached = await redis?.get(cacheKey);
      if (!cached) return;

      let list = (
        typeof cached === "string" ? JSON.parse(cached) : cached
      ) as SubscriptionItem[];

      // Xóa bản ghi cũ nếu đã tồn tại
      list = list.filter((item) => item.movie_slug !== updatedItem.movie_slug);

      // Thêm lại lên đầu nếu không phải hành động xóa và thỏa điều kiện lọc
      if (action !== "DELETE" && shouldInclude) {
        list.unshift(updatedItem);
        if (list.length > 20) list.pop();
      }

      await redis?.set(cacheKey, JSON.stringify(list), { ex: 3600 });
    };

    await Promise.all([
      updateSpecificCache("all", true),
      updateSpecificCache("new", updatedItem.has_new_episode),
    ]);
  },

  /**
   * 3. LẤY DANH SÁCH PHÂN TRANG (Infinite Scroll Ready)
   */
  getListPaginated: async (
    userId: string,
    { page = 1, limit = 15, filter = "all", keyword = "" },
  ) => {
    const isFirstPageNoSearch = page === 1 && !keyword;
    const key = getSubsKey(userId);
    const cacheKey = isFirstPageNoSearch ? `${key}:top:${filter}` : null;

    // A. Thử lấy từ Cache trang đầu
    if (cacheKey && redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        try {
          const parsed = (
            typeof cached === "string" ? JSON.parse(cached) : cached
          ) as SubscriptionItem[];
          return {
            data: parsed.slice(0, limit),
            nextCursor: parsed.length >= limit ? page + 1 : null,
            total: -1, // UI sẽ fetch số lượng từ API stats riêng để đảm bảo chính xác
          };
        } catch {
          await redis.del(cacheKey);
        }
      }
    }

    // B. Cache Miss -> Query Database
    const supabase = await createSupabaseServer();
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("user_subscriptions")
      .select("*", { count: "exact" })
      .eq("user_id", userId);
    if (filter === "new") query = query.eq("has_new_episode", true);
    if (keyword) query = query.ilike("movie_name", `%${keyword}%`);

    const { data, count, error } = await query
      .order("has_new_episode", { ascending: false })
      .order("updated_at", { ascending: false })
      .range(from, to);

    if (error) return { data: [], nextCursor: null, total: 0 };

    const result = {
      data: (data as SubscriptionItem[]) || [],
      total: count || 0,
      nextCursor: count && to < count - 1 ? page + 1 : null,
    };

    // C. Lưu Cache trang đầu
    if (cacheKey && redis && result.data.length > 0) {
      await redis.set(cacheKey, JSON.stringify(result.data), { ex: 3600 });
    }

    return result;
  },

  /**
   * 4. KIỂM TRA TRẠNG THÁI (Dùng cho nút Heart ở trang phim)
   */
  checkStatus: async (userId: string, movieSlug: string): Promise<boolean> => {
    const key = getSubsKey(userId);
    if (redis) {
      const cached = await redis.hget(key, movieSlug);
      if (cached) return true;
    }
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
   * 5. THÊM PHIM
   */
  add: async (userId: string, item: SubscriptionItem) => {
    const supabase = await createSupabaseServer();

    // 1. KIỂM TRA DB TRƯỚC
    const { data: existingItem } = await supabase
      .from("user_subscriptions")
      .select("has_new_episode")
      .eq("user_id", userId)
      .eq("movie_slug", item.movie_slug)
      .maybeSingle();

    const isNew = !existingItem;

    // 2. THỰC HIỆN UPSERT
    const newItem = {
      ...item,
      user_id: userId,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("user_subscriptions")
      .upsert(newItem, { onConflict: "user_id,movie_slug" });
    if (error) throw error;

    // 3. CẬP NHẬT CACHE (Luôn làm mới để đồng bộ DB)
    if (redis) {
      const key = getSubsKey(userId);
      await redis.hset(key, { [item.movie_slug]: JSON.stringify(newItem) });
      await redis.expire(key, CACHE_TTL);
    }

    // 4. CẬP NHẬT STATS DỰA TRÊN DỮ LIỆU THẬT
    if (isNew) {
      // Phim mới hoàn toàn
      await SubscriptionService.updateStatsCounter(
        userId,
        "ADD",
        newItem.has_new_episode,
      );
    } else if (existingItem.has_new_episode !== newItem.has_new_episode) {
      // Phim cũ nhưng trạng thái has_new_episode thay đổi
      await SubscriptionService.updateStatsCounter(
        userId,
        "STATUS_CHANGE",
        newItem.has_new_episode,
      );
    }

    await SubscriptionService.mutateTopCache(userId, newItem, "ADD");
    return newItem;
  },

  /**
   * 6. XÓA PHIM
   */
  remove: async (userId: string, movieSlug: string) => {
    const supabase = await createSupabaseServer();

    // Xóa và lấy lại trạng thái để trừ điểm stats
    const { data, error } = await supabase
      .from("user_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("movie_slug", movieSlug)
      .select("has_new_episode")
      .maybeSingle();

    if (error) throw error;

    if (data) {
      await SubscriptionService.updateStatsCounter(
        userId,
        "DELETE",
        data.has_new_episode,
      );
      await SubscriptionService.mutateTopCache(
        userId,
        { movie_slug: movieSlug } as SubscriptionItem,
        "DELETE",
      );
    }

    if (redis) await redis.hdel(getSubsKey(userId), movieSlug);
  },

  /**
   * 7. XÓA BADGE (Khi user xem phim)
   */
  clearBadge: async (userId: string, movieSlug: string) => {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase
      .from("user_subscriptions")
      .update({ has_new_episode: false })
      .eq("user_id", userId)
      .eq("movie_slug", movieSlug)
      .select()
      .maybeSingle();

    if (error) throw error;

    if (data) {
      // Lấy giá trị cũ từ cache hoặc cần query riêng
      const oldHasNew = redis
        ? JSON.parse((await redis.hget(getSubsKey(userId), movieSlug)) || "{}")
            .has_new_episode
        : true;

      if (redis)
        await redis
          .pipeline()
          .hset(getSubsKey(userId), {
            [movieSlug]: JSON.stringify(data),
          })
          .expire(getSubsKey(userId), CACHE_TTL)
          .exec();

      // Chỉ giảm stats nếu trước đó là true
      if (oldHasNew) {
        await SubscriptionService.updateStatsCounter(
          userId,
          "STATUS_CHANGE",
          false,
        );
      }
      await SubscriptionService.mutateTopCache(userId, data, "UPDATE");
    }
  },

  /**
   * 8. BẢNG ĐIỂM STATS (Running Counters)
   */
  updateStatsCounter: async (
    userId: string,
    action: "ADD" | "DELETE" | "STATUS_CHANGE",
    hasNew: boolean = false,
  ) => {
    if (!redis) return;
    const statsKey = getStatsKey(userId);
    if (!(await redis.exists(statsKey))) return;

    const pipeline = redis.pipeline();
    if (action === "ADD") {
      pipeline.hincrby(statsKey, "total", 1);
      if (hasNew) pipeline.hincrby(statsKey, "new_count", 1);
    } else if (action === "DELETE") {
      pipeline.hincrby(statsKey, "total", -1);
      if (hasNew) pipeline.hincrby(statsKey, "new_count", -1);
    } else if (action === "STATUS_CHANGE") {
      pipeline.hincrby(statsKey, "new_count", hasNew ? 1 : -1);
    }
    await pipeline.exec();
  },

  getStats: async (userId: string) => {
    const statsKey = getStatsKey(userId);
    if (redis) {
      const cached = await redis.hgetall(statsKey);
      if (cached && Object.keys(cached).length > 0) {
        return {
          total: Number(cached.total || 0),
          hasNewCount: Number(cached.new_count || 0),
        };
      }
    }

    const supabase = await createSupabaseServer();
    const { data } = await supabase
      .from("user_subscriptions")
      .select("has_new_episode")
      .eq("user_id", userId);
    const stats = {
      total: data?.length || 0,
      new_count: data?.filter((d) => d.has_new_episode).length || 0,
    };

    if (redis) {
      await redis.hset(statsKey, stats);
      await redis.expire(statsKey, 604800);
    }
    return { total: stats.total, hasNewCount: stats.new_count };
  },

  /**
   * 9. ĐỒNG BỘ LOCAL
   */
  syncLocal: async (userId: string, localSubs: SubscriptionItem[]) => {
    if (!localSubs || localSubs.length === 0) return;
    const supabase = await createSupabaseServer();
    const { data: dbSubs } = await supabase
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", userId);
    const dbMap = new Map(dbSubs?.map((s) => [s.movie_slug, s]));

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
        has_new_episode:
          dbItem?.has_new_episode || localItem.has_new_episode || false,
        updated_at: new Date().toISOString(),
      };
    });

    const { error } = await supabase
      .from("user_subscriptions")
      .upsert(upsertData, { onConflict: "user_id,movie_slug" });
    if (error) throw error;

    if (redis) {
      await redis.del(getSubsKey(userId));
      await SubscriptionService.invalidateTopCache(userId);
      await redis.del(getStatsKey(userId));
    }
  },
};
