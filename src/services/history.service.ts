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
   * Lấy lịch sử của MỘT bộ phim cụ thể (Dùng cho trang phim)
   */
  getLatest: async (
    userId: string,
    movieSlug: string,
  ): Promise<HistoryItem | null> => {
    const hashKey = `history:user:${userId}`;

    try {
      if (redis) {
        // HGET có thể trả về string (dữ liệu thô) hoặc null
        const movieData = await redis.hget<string | HistoryItem>(
          hashKey,
          movieSlug,
        );
        if (movieData) {
          console.log(`🚀[History Hit] Redis: ${movieSlug}`);
          return typeof movieData === "string"
            ? (JSON.parse(movieData) as HistoryItem)
            : movieData;
        }
      }

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

      if (data && redis) {
        await redis.hset(hashKey, { [movieSlug]: JSON.stringify(data) });
        await redis.expire(hashKey, 604800);
      }

      return data as HistoryItem;
    } catch (err) {
      console.error(
        `❌[HistoryService.getLatest] Fatal Error [${movieSlug}]:`,
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
    const key = getHistoryKey(userId, deviceId);
    if (!key) return [];

    if (redis) {
      // HGETALL trả về Record<string, string>
      const cached = await redis.hgetall<Record<string, string>>(key);
      if (cached && Object.keys(cached).length > 0) {
        return Object.values(cached)
          .map(
            (v: string | HistoryItem) =>
              (typeof v === "string" ? JSON.parse(v) : v) as HistoryItem,
          )
          .sort(
            (a, b) =>
              new Date(b.updated_at).getTime() -
              new Date(a.updated_at).getTime(),
          );
      }
    }

    const supabase = await createSupabaseServer();
    let query = supabase.from("watch_history").select("*");
    if (userId) query = query.eq("user_id", userId);
    else query = query.eq("device_id", deviceId);

    const { data, error } = await query.order("updated_at", {
      ascending: false,
    });
    if (error || !data) return [];

    if (redis && data.length > 0) {
      const pipeline = redis.pipeline();
      data.forEach((item) => {
        pipeline.hset(key, { [item.movie_slug]: JSON.stringify(item) });
      });
      pipeline.expire(key, 604800);
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

    const existing = await redis.hget<string | HistoryItem | null>(
      key,
      payload.movie_slug,
    );

    const historyItem: HistoryItem = existing
      ? ((typeof existing === "string"
          ? JSON.parse(existing)
          : existing) as HistoryItem)
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

    if (payload.last_episode_slug === payload.last_episode_of_movie_slug) {
      historyItem.is_finished = finalEpFinished;
    } else {
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
   */
  updateCache: async (userId: string, updatedItem: HistoryItem) => {
    if (!redis) return;
    const key = getHistoryKey(userId);
    if (!key) return;

    await redis.hset(key, {
      [updatedItem.movie_slug]: JSON.stringify(updatedItem),
    });
    await redis.expire(key, 604800);
  },

  /**
   * Lưu MỘT phim vào DB (Dùng khi user thoát trang/chuyển tập)
   */
  syncItemToDB: async (userId: string, incomingItem: HistoryItem) => {
    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("watch_history")
      .select("id, episodes_progress, last_episode_of_movie_slug, is_finished")
      .eq("user_id", userId)
      .eq("movie_slug", incomingItem.movie_slug)
      .maybeSingle();

    const existingProgress =
      (existing?.episodes_progress as Record<string, EpisodeProgress>) || {};
    const incomingProgress = incomingItem.episodes_progress || {};

    const mergedProgress = { ...existingProgress };
    for (const slug in incomingProgress) {
      const newEp = incomingProgress[slug];
      const oldEp = existingProgress[slug];
      mergedProgress[slug] = {
        ...newEp,
        ep_is_finished: oldEp?.ep_is_finished || newEp.ep_is_finished,
      };
    }

    const currentTotalLastSlug = incomingItem.last_episode_of_movie_slug;
    const storedTotalLastSlug = existing?.last_episode_of_movie_slug;
    let isMovieFinished = false;

    if (storedTotalLastSlug && currentTotalLastSlug !== storedTotalLastSlug) {
      isMovieFinished = false;
    } else {
      isMovieFinished =
        mergedProgress[currentTotalLastSlug]?.ep_is_finished || false;
    }

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
      id: existing?.id,
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

    const { error } = await supabase
      .from("watch_history")
      .upsert(finalItem, { onConflict: "id" });
    if (error) throw error;

    await HistoryService.updateCache(userId, finalItem as HistoryItem);
  },

  /**
   * LƯU NHIỀU PHIM VÀO DB (Xử lý lỗi N+1 Query)
   */
  bulkSyncToDB: async (userId: string, localItems: HistoryItem[]) => {
    if (!localItems || localItems.length === 0) return;

    const supabase = await createSupabaseServer();
    const movieSlugs = localItems.map((item) => item.movie_slug);

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
      cachePayloads.push(finalItem as HistoryItem);
    }

    const { error } = await supabase
      .from("watch_history")
      .upsert(upsertPayloads, { onConflict: "id" });
    if (error) throw error;

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
