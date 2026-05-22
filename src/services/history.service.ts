import "server-only";

import { redis } from "@/lib/redis";
import { createSupabaseServer } from "@/lib/supabase/server";
import { HistoryItem, HistoryUpdatePayload, EpisodeProgress } from "@/types";
import { DashboardService } from "@/services/dashboard.service";

const getHistoryKey = (userId?: string, deviceId?: string) => {
  if (userId) return `history:user:${userId}`;
  if (deviceId) return `history:device:${deviceId}`;
  return null;
};

function parseHistoryCache(cached: string | HistoryItem[]): HistoryItem[] {
  const list = typeof cached === "string" ? JSON.parse(cached) : cached;
  if (!Array.isArray(list)) throw new Error("Cache không phải array");
  return list;
}

export const HistoryService = {
  /**
   * 1. HỦY CACHE TRANG ĐẦU (Dùng khi Xóa hoặc Sync số lượng lớn)
   */
  invalidateHistoryCache: async (userId?: string, deviceId?: string) => {
    if (!redis) return;
    const key = getHistoryKey(userId, deviceId);
    if (!key) return;

    const pipeline = redis.pipeline();
    pipeline.del(`${key}:top:all`);
    pipeline.del(`${key}:top:watching`);
    pipeline.del(`${key}:top:finished`);
    await pipeline.exec();
  },

  /**
   * 2. SỬA CACHE TRANG ĐẦU TẠI CHỖ (Mutation - Nhanh như chớp)
   * Dùng khi cập nhật tiến trình xem (trackProgress)
   */
  mutateTopCache: async (
    userId?: string,
    deviceId?: string,
    updatedItem?: HistoryItem,
  ) => {
    if (!redis || !updatedItem) return;
    const key = getHistoryKey(userId, deviceId);
    if (!key) return;

    const updateSpecificCache = async (
      filter: string,
      shouldInclude: boolean,
    ) => {
      const cacheKey = `${key}:top:${filter}`;

      // STRATEGY: Luôn lưu dạng string, luôn parse khi đọc
      const cachedData = await redis?.get<string>(cacheKey);

      if (!cachedData) return; // Nếu ngăn này chưa ai tạo thì bỏ qua

      let list: HistoryItem[] = [];

      try {
        list = parseHistoryCache(cachedData);
      } catch {
        // Nếu parse lỗi, dọn dẹp cache
        console.warn(
          `[HistoryService] Invalid cache at ${cacheKey}, clearing...`,
        );
        await redis?.del(cacheKey);
        return;
      }

      // Xóa bản ghi cũ nếu đã tồn tại
      list = list.filter((item) => item.movie_slug !== updatedItem.movie_slug);

      // Nhét lên đầu trang nếu thỏa mãn điều kiện bộ lọc
      if (shouldInclude) {
        list.unshift(updatedItem);
        if (list.length > 16) list.pop(); // Giữ đúng giới hạn trang chủ
      }

      // Luôn stringify trước khi set
      await redis?.set(cacheKey, JSON.stringify(list), { ex: 3600 });
    };

    // Chạy song song cập nhật cả 3 ngăn Cache
    await Promise.all([
      updateSpecificCache("all", true),
      updateSpecificCache("watching", !updatedItem.is_finished),
      updateSpecificCache("finished", updatedItem.is_finished),
    ]);
  },

  /**
   * 3. Lấy 1 bộ phim (Dùng cho trang phim)
   */
  getLatest: async (
    userId: string,
    movieSlug: string,
  ): Promise<HistoryItem | null> => {
    const hashKey = `history:user:${userId}`;

    try {
      if (redis) {
        const movieData = await redis.hget<string | HistoryItem>(
          hashKey,
          movieSlug,
        );
        if (movieData) {
          return typeof movieData === "string"
            ? JSON.parse(movieData)
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

      if (error) return null;

      if (data && redis) {
        await redis.hset(hashKey, { [movieSlug]: JSON.stringify(data) });
        await redis.expire(hashKey, 604800);
      }

      return data as HistoryItem;
    } catch (err) {
      console.error(`❌[HistoryService.getLatest] Error:`, err);
      return null;
    }
  },

  /**
   * 4. Lấy danh sách (Có Redis chặn cửa cho trang đầu)
   */
  getListPaginated: async ({
    userId,
    deviceId,
    page = 1,
    limit = 12,
    keyword = "",
    filter = "all",
  }: {
    userId?: string;
    deviceId?: string;
    page?: number;
    limit?: number;
    keyword?: string;
    filter?: string;
  }) => {
    const isFirstPageNoSearch = page === 1 && !keyword;
    const key = getHistoryKey(userId, deviceId);
    const cacheKey = isFirstPageNoSearch && key ? `${key}:top:${filter}` : null;

    // A. Thử lấy từ Cache trước
    if (cacheKey && redis) {
      const cached = await redis.get<string | HistoryItem[]>(cacheKey);
      if (cached) {
        try {
          const parsed = parseHistoryCache(cached);

          return {
            data: parsed.slice(0, limit),
            nextCursor: parsed.length >= limit ? 2 : null,
            total: parsed.length,
          };
        } catch {
          console.warn(
            `[HistoryService] Invalid cache at ${cacheKey}, clearing...`,
          );
          redis.del(cacheKey).catch(() => {});
        }
      }
    }
    // B. Cache Miss -> Xuống Database
    const supabase = await createSupabaseServer();
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase.from("watch_history").select("*", { count: "exact" });
    if (userId) query = query.eq("user_id", userId);
    else query = query.eq("device_id", deviceId);

    if (filter === "finished") query = query.eq("is_finished", true);
    else if (filter === "watching") query = query.eq("is_finished", false);
    if (keyword) query = query.ilike("movie_name", `%${keyword}%`);

    const { data, error, count } = await query
      .order("updated_at", { ascending: false })
      .range(from, to);

    if (error) return { data: [], nextCursor: null, total: 0 };

    const result = {
      data: (data as HistoryItem[]) || [],
      nextCursor: count && to < count - 1 ? page + 1 : null,
      total: count || 0,
    };

    // C. Lưu Cache
    if (cacheKey && redis && result.data.length > 0) {
      await redis.set(cacheKey, JSON.stringify(result.data), { ex: 3600 });
    }

    return result;
  },

  /**
   * 5. XÓA 1 phim
   */
  deleteItem: async (userId: string, movieSlug: string) => {
    const supabase = await createSupabaseServer();

    // 1. Thêm .select() để lấy trạng thái is_finished của phim vừa bị xóa
    const { data, error } = await supabase
      .from("watch_history")
      .delete()
      .eq("user_id", userId)
      .eq("movie_slug", movieSlug)
      .select("is_finished");

    if (error) throw error;

    // 2. Nếu thực sự có phim bị xóa, ta lấy trạng thái đó để cập nhật bảng điểm
    if (data && data.length > 0) {
      const isFinished = data[0].is_finished;
      await HistoryService.updateStatsCounter(userId, "DELETE", isFinished);
    }

    // 3. Xóa Cache
    if (redis) {
      const key = getHistoryKey(userId);
      if (key) {
        await redis.hdel(key, movieSlug);
        await HistoryService.invalidateHistoryCache(userId);
      }
    }

    await DashboardService.invalidateStatsCache(userId);
  },

  /**
   * 6. XÓA TOÀN BỘ
   */
  clearAll: async (userId: string) => {
    const supabase = await createSupabaseServer();
    const { error } = await supabase
      .from("watch_history")
      .delete()
      .eq("user_id", userId);

    if (error) throw error;

    if (redis) {
      const key = getHistoryKey(userId);
      if (key) {
        await redis.del(key); // Xóa toàn bộ lịch sử trong Redis
        await HistoryService.invalidateHistoryCache(userId); // Xóa mảng Top Cache
      }

      // Reset bảng điểm về 0 bằng cách xóa luôn key stats
      const statsKey = `history:stats:user:${userId}`;
      await redis.del(statsKey);

      await DashboardService.invalidateStatsCache(userId);
    }
  },

  /**
   * 7. TRACKING (Cứ 30s ghi 1 lần)
   * Lua script chạy trên Redis server nên đảm bảo không bị xen giữa bởi request khác.
   */
  trackProgress: async (payload: HistoryUpdatePayload) => {
    const key = getHistoryKey(payload.user_id, payload.device_id);
    if (!key || !redis) return;

    // ============================================================
    // BƯỚC 1: Chuẩn bị dữ liệu historyItem trước khi ghi (client-side)
    // ============================================================
    const existing = await redis.hget<string | HistoryItem | null>(
      key,
      payload.movie_slug,
    );

    const parsedExisting: HistoryItem | null = existing
      ? ((typeof existing === "string"
          ? JSON.parse(existing)
          : existing) as HistoryItem)
      : null;

    const oldIsFinished = parsedExisting?.is_finished || false;

    const historyItem: HistoryItem = parsedExisting
      ? { ...parsedExisting }
      : {
          movie_slug: payload.movie_slug,
          movie_name: payload.movie_name || "",
          movie_poster: payload.movie_poster || "",
          episodes_progress: {},
          last_episode_slug: payload.last_episode_slug,
          last_episode_of_movie_slug: payload.last_episode_of_movie_slug,
          is_finished: false,
          updated_at: new Date().toISOString(),
          movie_metadata: payload.movie_metadata,
        };

    if (parsedExisting && payload.movie_metadata) {
      historyItem.movie_metadata = payload.movie_metadata;
    }

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

    const newIsFinished = historyItem.is_finished;

    // ============================================================
    // BƯỚC 2: Atomic write bằng Lua script - tránh TOCTOU race condition
    // Lua script chạy single-threaded trên Redis → không bị xen giữa
    // Return: 1 nếu phim mới (chưa tồn tại), 0 nếu phim đã có
    // ============================================================
    const TRACK_LUA_SCRIPT = `
      local key = KEYS[1]
      local field = ARGV[1]
      local value = ARGV[2]
      local ttl = tonumber(ARGV[3])

      local existing = redis.call('HGET', key, field)
      local isNew = (existing == false) and 1 or 0

      redis.call('HSET', key, field, value)
      redis.call('EXPIRE', key, ttl)

      return isNew
    `;

    try {
      const isNewMovie =
        (await redis.eval(
          TRACK_LUA_SCRIPT,
          [key],
          [payload.movie_slug, JSON.stringify(historyItem), "604800"],
        )) === 1;

      // GỌI BẢNG ĐIỂM - isNewMovie giờ đã chính xác từ Lua (atomic)
      if (payload.user_id) {
        if (isNewMovie) {
          await HistoryService.updateStatsCounter(
            payload.user_id,
            "ADD",
            newIsFinished,
          );
        } else if (oldIsFinished !== newIsFinished) {
          await HistoryService.updateStatsCounter(
            payload.user_id,
            "STATUS_CHANGE",
            newIsFinished,
          );
        }
      }

      // SỬA TOP CACHE
      await HistoryService.mutateTopCache(
        payload.user_id,
        payload.device_id,
        historyItem,
      );

      if (payload.user_id)
        await DashboardService.invalidateStatsCache(payload.user_id);
    } catch (error) {
      console.error(
        `[HistoryService.trackProgress] Lua script failed for ${payload.movie_slug}:`,
        error,
      );
    }
  },

  /**
   * 8. SYNC VÀO DB (Khi chuyển tập / Tắt trang)
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
        // Một khi đã finished thì không bao giờ unfinish (bảo vệ trạng thái)
        ep_is_finished: oldEp?.ep_is_finished === true
          ? true
          : newEp.ep_is_finished,
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

    const finalItem: HistoryItem = {
      ...(existing?.id ? { id: existing.id } : {}),
      user_id: userId,
      movie_slug: incomingItem.movie_slug,
      movie_name: incomingItem.movie_name,
      movie_poster: incomingItem.movie_poster,
      last_episode_slug: latestEpSlug,
      last_episode_of_movie_slug: currentTotalLastSlug,
      episodes_progress: mergedProgress,
      is_finished: isMovieFinished,
      updated_at: new Date().toISOString(),
      movie_metadata: incomingItem.movie_metadata,
    };

    const { error } = await supabase
      .from("watch_history")
      .upsert(finalItem, { onConflict: "user_id,movie_slug" });
    if (error) throw error;

    if (redis) {
      const key = getHistoryKey(userId);
      if (key) {
        await redis.hset(key, {
          [finalItem.movie_slug]: JSON.stringify(finalItem),
        });
        await redis.expire(key, 604800);
      }
    }
    // Sửa cache trang chủ tại chỗ (KHÔNG invalidate để giữ cache hit rate cao)
    await HistoryService.mutateTopCache(
      userId,
      undefined,
      finalItem,
    );

    // Chỉ invalidate dashboard stats cache (vì cần tính toán lại)
    await DashboardService.invalidateStatsCache(userId);
  },

  /**
   * 9. LƯU SỐ LƯỢNG LỚN (Bulk)
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

    // Tách riêng 2 mảng Insert và Update để tránh xung đột Schema của Supabase
    const itemsToInsert = [];
    const itemsToUpdate = [];
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
          // Một khi đã finished thì không bao giờ unfinish (bảo vệ trạng thái)
          ep_is_finished: oldEp?.ep_is_finished === true
            ? true
            : newEp.ep_is_finished,
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

      // Khởi tạo object dữ liệu nền (KHÔNG chứa trường id)
      const baseItem = {
        user_id: userId,
        movie_slug: item.movie_slug,
        movie_name: item.movie_name,
        movie_poster: item.movie_poster,
        last_episode_slug: latestEpSlug,
        last_episode_of_movie_slug: currentTotalLastSlug,
        episodes_progress: mergedProgress,
        is_finished: isMovieFinished,
        updated_at: new Date().toISOString(),
        movie_metadata: item.movie_metadata,
      };

      // Phân loại logic
      if (existing?.id) {
        // Đã có trên DB -> Ném vào mảng Update (bắt buộc kèm id)
        itemsToUpdate.push({ id: existing.id, ...baseItem });
        cachePayloads.push({ id: existing.id, ...baseItem } as HistoryItem);
      } else {
        // Chưa có trên DB -> Ném vào mảng Insert (bỏ id để DB tự sinh UUID)
        itemsToInsert.push(baseItem);
        cachePayloads.push(baseItem as HistoryItem);
      }
    }

    // Thực thi tuần tự để đảm bảo an toàn, dễ bắt lỗi riêng biệt
    if (itemsToInsert.length > 0) {
      const { error: insertErr } = await supabase
        .from("watch_history")
        .insert(itemsToInsert);
      if (insertErr) throw insertErr;
    }

    if (itemsToUpdate.length > 0) {
      const { error: updateErr } = await supabase
        .from("watch_history")
        .upsert(itemsToUpdate, { onConflict: "id" });
      if (updateErr) throw updateErr;
    }

    // Xử lý Redis Cache
    if (redis) {
      const key = getHistoryKey(userId);
      if (key) {
        const pipeline = redis.pipeline();
        cachePayloads.forEach((item) => {
          pipeline.hset(key, { [item.movie_slug]: JSON.stringify(item) });
        });
        pipeline.expire(key, 604800);
        await pipeline.exec();

        // Bulk sync cần invalidate vì số lượng lớn, không thể mutate từng item
        await HistoryService.invalidateHistoryCache(userId);
      }
    }

    await DashboardService.invalidateStatsCache(userId);
  },

  /**
   * 9. HÀM CẬP NHẬT BẢNG ĐIỂM (Chạy ngầm mỗi khi trackProgress hoặc delete)
   */
  updateStatsCounter: async (
    userId: string,
    action: "ADD" | "DELETE" | "STATUS_CHANGE",
    isFinishedNow: boolean = false,
  ) => {
    if (!redis) return;
    const statsKey = `history:stats:user:${userId}`;

    // Kiểm tra xem bảng điểm đã tồn tại chưa (nếu chưa thì bỏ qua để hàm getStats tự fallback đếm lại từ DB)
    const exists = await redis.exists(statsKey);
    if (!exists) return;

    const pipeline = redis.pipeline();

    if (action === "ADD") {
      pipeline.hincrby(statsKey, "total", 1);
      pipeline.hincrby(statsKey, isFinishedNow ? "finished" : "watching", 1);
    } else if (action === "DELETE") {
      pipeline.hincrby(statsKey, "total", -1);
      pipeline.hincrby(statsKey, isFinishedNow ? "finished" : "watching", -1);
    } else if (action === "STATUS_CHANGE") {
      if (isFinishedNow) {
        pipeline.hincrby(statsKey, "watching", -1);
        pipeline.hincrby(statsKey, "finished", 1);
      } else {
        pipeline.hincrby(statsKey, "watching", 1);
        pipeline.hincrby(statsKey, "finished", -1);
      }
    }
    await pipeline.exec();
  },

  /**
   * 10. LẤY THỐNG KÊ (Zero-Query cho UI)
   */
  getStats: async (userId: string) => {
    const statsKey = `history:stats:user:${userId}`;

    if (redis) {
      const cachedStats = await redis.hgetall(statsKey);
      if (cachedStats && Object.keys(cachedStats).length > 0) {
        return {
          total: Number(cachedStats.total || 0),
          watching: Number(cachedStats.watching || 0),
          finished: Number(cachedStats.finished || 0),
        };
      }
    }

    // FALLBACK: Nếu Redis rỗng (bị xóa cache), đành phải chọc DB 1 lần để tạo lại bảng điểm
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase
      .from("watch_history")
      .select("is_finished") // Chỉ select cột is_finished cho nhẹ
      .eq("user_id", userId);

    if (error || !data) return { total: 0, watching: 0, finished: 0 };

    const total = data.length;
    const finished = data.filter((d) => d.is_finished).length;
    const watching = total - finished;

    // Tạo lại bảng điểm trên Redis, lưu 7 ngày
    if (redis) {
      await redis.hset(statsKey, { total, watching, finished });
      await redis.expire(statsKey, 604800);
    }

    return { total, watching, finished };
  },
};
