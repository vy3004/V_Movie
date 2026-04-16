import "server-only";
import { redis } from "@/lib/redis";
import { createSupabaseServer } from "@/lib/supabase/server";
import { HistoryItem, HistoryUpdatePayload, EpisodeProgress } from "@/types";

const getHistoryKey = (userId?: string, deviceId?: string) => {
  if (userId) return `history:user:${userId}`;
  if (deviceId) return `history:device:${deviceId}`;
  return null;
};

export const HistoryService = {
  /**
   *  Lấy lịch sử của MỘT bộ phim cụ thể (Dùng cho trang phim)
   * Priority: Redis Hash -> Supabase -> Backfill Redis
   */
  getLatest: async (
    userId: string,
    movieSlug: string,
  ): Promise<HistoryItem | null> => {
    const hashKey = `history:user:${userId}`;

    try {
      // BƯỚC 1: Truy vấn Redis Hash (Cực nhanh)
      if (redis) {
        const movieData = await redis.hget<HistoryItem>(hashKey, movieSlug);
        if (movieData) {
          console.log(`[History Hit] Redis: ${movieSlug}`);
          // Nếu redis trả về string (tùy client), ta parse, nếu object rồi thì trả về luôn
          return typeof movieData === "string"
            ? JSON.parse(movieData)
            : movieData;
        }
      }

      // BƯỚC 2: Cache Miss -> Truy vấn Supabase
      const supabase = await createSupabaseServer();
      const { data, error } = await supabase
        .from("watch_history")
        .select("*")
        .eq("user_id", userId)
        .eq("movie_slug", movieSlug)
        .maybeSingle();

      if (error) {
        console.error(
          "❌ [HistoryService.getLatest] Supabase Error:",
          error.message,
        );
        return null;
      }

      // BƯỚC 3: Nếu tìm thấy trong DB, thực hiện Backfill (Nạp ngược lại Cache)
      if (data && redis) {
        // Lưu vào Hash với field là movie_slug
        await redis.hset(hashKey, { [movieSlug]: JSON.stringify(data) });
        // Set expire cho toàn bộ hash lịch sử của user (ví dụ: 7 ngày)
        await redis.expire(hashKey, 604800);
      }

      return data as HistoryItem;
    } catch (err) {
      console.error(
        `❌ [HistoryService.getLatest] Fatal Error [${movieSlug}]:`,
        err,
      );
      return null;
    }
  },

  /**
   * 1. Lấy danh sách lịch sử (Redis -> DB -> Backfill)
   */
  getList: async (
    userId?: string,
    deviceId?: string,
  ): Promise<HistoryItem[]> => {
    const key = getHistoryKey(userId || undefined, deviceId || undefined);
    if (!key) return [];

    // Thử lấy từ Redis
    if (redis) {
      const cached = await redis.hgetall(key);
      if (cached && Object.keys(cached).length > 0) {
        return Object.values(cached)
          .map((v: any) => (typeof v === "string" ? JSON.parse(v) : v))
          .sort(
            (a, b) =>
              new Date(b.updated_at).getTime() -
              new Date(a.updated_at).getTime(),
          );
      }
    }

    // Cache miss -> Vào DB
    const supabase = await createSupabaseServer();
    let query = supabase.from("watch_history").select("*");
    if (userId) query = query.eq("user_id", userId);
    else query = query.eq("device_id", deviceId);

    const { data, error } = await query.order("updated_at", {
      ascending: false,
    });
    if (error || !data) return [];

    // Backfill vào Redis
    if (redis && data.length > 0) {
      const pipeline = redis.pipeline();
      data.forEach((item) => {
        pipeline.hset(key, { [item.movie_slug]: JSON.stringify(item) });
      });
      pipeline.expire(key, 604800); // 7 ngày
      await pipeline.exec();
    }

    return data as HistoryItem[];
  },

  /**
   * 2. Tracking nhanh vào Redis (Dành cho Beacon định kỳ 30s)
   */
  trackProgress: async (payload: HistoryUpdatePayload) => {
    const key = getHistoryKey(payload.user_id, payload.device_id);
    if (!key || !redis) return;

    const existing: any = await redis.hget(key, payload.movie_slug);
    const historyItem: HistoryItem = existing
      ? typeof existing === "string"
        ? JSON.parse(existing)
        : existing
      : {
          movie_slug: payload.movie_slug,
          movie_name: payload.movie_name || "",
          movie_poster: payload.movie_poster || "",
          episodes_progress: {},
          last_episode_slug: payload.last_episode_slug,
          last_episode_of_movie_slug: payload.last_episode_of_movie_slug,
          is_finished: false,
          updated_at: new Date().toISOString(),
        };

    const isCurrentEpFinished =
      payload.duration > 0 && payload.current_time / payload.duration > 0.9;

    const finalEpFinished =
      historyItem.episodes_progress[payload.last_episode_slug]
        ?.ep_is_finished || isCurrentEpFinished;

    historyItem.episodes_progress[payload.last_episode_slug] = {
      ep_last_time: payload.current_time,
      ep_duration: payload.duration,
      ep_is_finished: finalEpFinished,
      ep_updated_at: new Date().toISOString(),
    };

    historyItem.last_episode_slug = payload.last_episode_slug;
    historyItem.updated_at = new Date().toISOString();

    // Kiểm tra cờ is_finished của CẢ BỘ PHIM
    if (payload.last_episode_slug === payload.last_episode_of_movie_slug) {
      historyItem.is_finished = finalEpFinished;
    } else {
      // Nếu đang xem tập giữa chừng, thì lấy cờ cũ của tập cuối
      historyItem.is_finished =
        historyItem.episodes_progress[payload.last_episode_of_movie_slug]
          ?.ep_is_finished || false;
    }

    await redis.hset(key, {
      [payload.movie_slug]: JSON.stringify(historyItem),
    });
    await redis.expire(key, 604800);
  },

  /**
   * Cập nhật Cache Redis thay vì xóa (Write-through Cache)
   * Giúp hệ thống không bị Cache Miss ở lần truy cập sau
   */
  updateCache: async (userId: string, updatedItem: HistoryItem) => {
    if (!redis) return;
    const key = getHistoryKey(userId);
    if (!key) return;

    // Ghi đè bộ phim này vào Hash hiện tại
    await redis.hset(key, {
      [updatedItem.movie_slug]: JSON.stringify(updatedItem),
    });
    // Gia hạn thời gian sống
    await redis.expire(key, 604800); // 7 ngày
  },

  /**
   * Lưu MỘT phim vào DB (Dùng khi user thoát trang/chuyển tập)
   */
  syncItemToDB: async (userId: string, incomingItem: HistoryItem) => {
    const supabase = await createSupabaseServer();

    // 1. Lấy dữ liệu cũ để merge (tránh mất các tập khác)
    const { data: existing } = await supabase
      .from("watch_history")
      .select("id, episodes_progress, last_episode_of_movie_slug, is_finished")
      .eq("user_id", userId)
      .eq("movie_slug", incomingItem.movie_slug)
      .maybeSingle();

    const existingProgress =
      (existing?.episodes_progress as Record<string, EpisodeProgress>) || {};
    const incomingProgress = incomingItem.episodes_progress || {};

    // 2. Merge tiến độ
    const mergedProgress = { ...existingProgress };
    for (const slug in incomingProgress) {
      const newEp = incomingProgress[slug];
      const oldEp = existingProgress[slug];
      mergedProgress[slug] = {
        ...newEp,
        ep_is_finished: oldEp?.ep_is_finished || newEp.ep_is_finished,
      };
    }

    // 3. Xử lý tập phim mới (Auto-reopen)
    const currentTotalLastSlug = incomingItem.last_episode_of_movie_slug;
    const storedTotalLastSlug = existing?.last_episode_of_movie_slug;
    let isMovieFinished = false;

    if (storedTotalLastSlug && currentTotalLastSlug !== storedTotalLastSlug) {
      isMovieFinished = false; // Có tập mới -> Chưa xong
    } else {
      isMovieFinished =
        mergedProgress[currentTotalLastSlug]?.ep_is_finished || false;
    }

    // 4. Tìm tập vừa xem gần nhất
    let latestEpSlug = incomingItem.last_episode_slug;
    let latestTime = 0;
    for (const slug in mergedProgress) {
      const t = new Date(mergedProgress[slug].ep_updated_at).getTime();
      if (t > latestTime) {
        latestTime = t;
        latestEpSlug = slug;
      }
    }

    const finalItem = {
      id: existing?.id, // Có ID thì Update, không thì Insert
      user_id: userId,
      movie_slug: incomingItem.movie_slug,
      movie_name: incomingItem.movie_name,
      movie_poster: incomingItem.movie_poster,
      last_episode_slug: latestEpSlug,
      last_episode_of_movie_slug: currentTotalLastSlug,
      episodes_progress: mergedProgress,
      is_finished: isMovieFinished,
      updated_at: new Date().toISOString(),
    };

    // 5. Lưu DB
    const { error } = await supabase
      .from("watch_history")
      .upsert(finalItem, { onConflict: "user_id,movie_slug" });
    if (error) throw error;

    // 6. Cập nhật Cache Redis (Không Purge)
    await HistoryService.updateCache(userId, finalItem);
  },

  /**
   * LƯU NHIỀU PHIM VÀO DB (Xử lý lỗi N+1 Query)
   * Dùng khi Guest đăng nhập và đẩy LocalStorage lên
   */
  bulkSyncToDB: async (userId: string, localItems: HistoryItem[]) => {
    if (!localItems || localItems.length === 0) return;

    const supabase = await createSupabaseServer();
    const movieSlugs = localItems.map((item) => item.movie_slug);

    // 1. LẤY TOÀN BỘ DATA CŨ TRONG 1 LẦN (Khử N+1)
    const { data: existingRecords } = await supabase
      .from("watch_history")
      .select(
        "id, movie_slug, episodes_progress, last_episode_of_movie_slug, is_finished",
      )
      .eq("user_id", userId)
      .in("movie_slug", movieSlugs);

    const existingMap = new Map(existingRecords?.map((r) => [r.movie_slug, r]));
    const upsertPayloads = [];
    const cachePayloads: HistoryItem[] = [];

    // 2. MERGE TRONG RAM
    for (const item of localItems) {
      const existing = existingMap.get(item.movie_slug);
      const existingProgress =
        (existing?.episodes_progress as Record<string, EpisodeProgress>) || {};
      const incomingProgress = item.episodes_progress || {};

      const mergedProgress = { ...existingProgress };
      for (const slug in incomingProgress) {
        const newEp = incomingProgress[slug];
        const oldEp = existingProgress[slug];
        mergedProgress[slug] = {
          ...newEp,
          ep_is_finished: oldEp?.ep_is_finished || newEp.ep_is_finished,
        };
      }

      const currentTotalLastSlug = item.last_episode_of_movie_slug;
      const storedTotalLastSlug = existing?.last_episode_of_movie_slug;
      let isMovieFinished = false;

      if (storedTotalLastSlug && currentTotalLastSlug !== storedTotalLastSlug) {
        isMovieFinished = false;
      } else {
        isMovieFinished =
          mergedProgress[currentTotalLastSlug]?.ep_is_finished || false;
      }

      let latestEpSlug = item.last_episode_slug;
      let latestTime = 0;
      for (const slug in mergedProgress) {
        const t = new Date(mergedProgress[slug].ep_updated_at).getTime();
        if (t > latestTime) {
          latestTime = t;
          latestEpSlug = slug;
        }
      }

      const finalItem = {
        id: existing?.id,
        user_id: userId,
        movie_slug: item.movie_slug,
        movie_name: item.movie_name,
        movie_poster: item.movie_poster,
        last_episode_slug: latestEpSlug,
        last_episode_of_movie_slug: currentTotalLastSlug,
        episodes_progress: mergedProgress,
        is_finished: isMovieFinished,
        updated_at: new Date().toISOString(),
      };

      upsertPayloads.push(finalItem);
      cachePayloads.push(finalItem);
    }

    // 3. BULK UPSERT VÀO DB TRONG 1 LẦN
    const { error } = await supabase
      .from("watch_history")
      .upsert(upsertPayloads, { onConflict: "user_id,movie_slug" });
    if (error) throw error;

    // 4. BULK UPDATE VÀO REDIS
    if (redis) {
      const key = getHistoryKey(userId);
      if (key) {
        const pipeline = redis.pipeline();
        cachePayloads.forEach((item) => {
          pipeline.hset(key, { [item.movie_slug]: JSON.stringify(item) });
        });
        pipeline.expire(key, 604800);
        await pipeline.exec();
      }
    }
  },
};
