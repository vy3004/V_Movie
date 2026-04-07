import {
  HistoryItem,
  EpisodeProgress,
  HistoryUpdatePayload,
} from "@/lib/types";
import { redis } from "@/lib/redis";

// Device ID helper for guest users
const DEVICE_ID_KEY = "v_movie_device_id";

export const getDeviceId = (): string => {
  if (typeof window === "undefined") return "";

  try {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      // Generate a UUID-like string
      deviceId = crypto.randomUUID
        ? crypto.randomUUID()
        : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch (error) {
    console.error("[LocalStorage] Error getting device ID:", error);
    return "";
  }
};

export const convertToEmbedUrl = (url: string): string => {
  const videoId = extractYouTubeVideoId(url);

  if (videoId) return `https://www.youtube.com/embed/${videoId}`;

  return url;
};

const extractYouTubeVideoId = (url: string): string | null => {
  const regex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|.+\?v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);

  return match ? match[1] : null;
};

export const formatUrl = (path: string | undefined): string => {
  if (!path) return "#";
  if (path.startsWith("/danh-sach/")) return path.replace("/danh-sach", "");
  if (path.startsWith("/the-loai/"))
    return `/phim-moi-cap-nhat?category=${encodeURIComponent(
      path.split("/the-loai/")[1],
    )}`;
  if (path.startsWith("/quoc-gia/"))
    return `/phim-moi-cap-nhat?country=${encodeURIComponent(
      path.split("/quoc-gia/")[1],
    )}`;
  return path;
};

const GUEST_HISTORY_KEY = "v_movie_guest_history";

export const saveLocalHistory = (item: HistoryItem) => {
  if (typeof window === "undefined") return;

  try {
    const history = getLocalHistory();

    // Lọc bỏ record cũ của phim hiện tại
    const filteredHistory = history.filter(
      (h) => h.movie_slug !== item.movie_slug,
    );

    // Thêm bản ghi mới lên đầu mảng
    const newHistory = [item, ...filteredHistory].slice(0, 20);

    localStorage.setItem(GUEST_HISTORY_KEY, JSON.stringify(newHistory));

    // Dispatch event mượt mà cho UI khác (Navbar, trang chủ) cập nhật ngay lập tức
    window.dispatchEvent(
      new CustomEvent("local-history-updated", { detail: item }),
    );
  } catch (error) {
    console.error("[LocalStorage] Error saving history:", error);
  }
};

export const getLocalHistory = (): HistoryItem[] => {
  if (typeof window === "undefined") return [];

  try {
    const data = localStorage.getItem(GUEST_HISTORY_KEY);
    if (!data) return [];

    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item) => item && typeof item === "object" && item.movie_slug,
      );
    }
    return [];
  } catch (error) {
    console.error("[LocalStorage] Error reading history:", error);
    return [];
  }
};

export const formatDuration = (seconds: number) => {
  if (!seconds || seconds <= 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

// Redis Cache Helpers
const HISTORY_CACHE_PREFIX = "history";
const HISTORY_CACHE_TTL = 60 * 60 * 24 * 7;

export const getHistoryCacheKey = (
  userId?: string,
  deviceId?: string,
): string | null => {
  if (userId) {
    return `${HISTORY_CACHE_PREFIX}:user:${userId}`;
  }
  if (deviceId) {
    return `${HISTORY_CACHE_PREFIX}:device:${deviceId}`;
  }
  return null;
};

export const updateHistoryCache = async (
  userId: string | undefined,
  deviceId: string | undefined,
  payload: HistoryUpdatePayload,
) => {
  const key = getHistoryCacheKey(userId, deviceId);

  if (!key || !redis) {
    console.warn(
      "Missing credentials or Redis not initialized. Cannot update cache.",
    );
    return;
  }

  try {
    // Lấy dữ liệu cũ (truyền tham số an toàn)
    const existingHistory = await getHistoryCache(userId, deviceId);
    const existingHistoryItem = existingHistory?.[payload.movie_slug];

    // Tính toán tiến độ tập hiện tại
    const isFinished = payload.current_time / payload.duration > 0.9;
    const existingEp =
      existingHistoryItem?.episodes_progress?.[payload.last_episode_slug];

    // LOGIC: Nếu đã từng xong (true), thì giữ nguyên true (vĩnh viễn)
    const isEpFinished = existingEp?.ep_is_finished || isFinished;

    const newEpisodeProgress: EpisodeProgress = {
      ep_last_time: payload.current_time,
      ep_duration: payload.duration,
      ep_is_finished: isEpFinished,
      ep_updated_at: new Date().toISOString(),
    };

    const updatedEpisodesProgress = {
      ...(existingHistoryItem?.episodes_progress || {}),
      [payload.last_episode_slug]: newEpisodeProgress,
    };

    // LOGIC: Phim chỉ xong khi tập cuối (last_episode_of_movie_slug) đã xong
    const isMovieCompletelyFinished =
      updatedEpisodesProgress[payload.last_episode_of_movie_slug]
        ?.ep_is_finished === true;

    const updatedHistoryItem: HistoryItem = {
      movie_slug: payload.movie_slug,
      movie_name:
        payload.movie_name || existingHistoryItem?.movie_name || "Unknown",
      movie_poster:
        payload.movie_poster || existingHistoryItem?.movie_poster || "",
      last_episode_slug: payload.last_episode_slug,
      last_episode_of_movie_slug: payload.last_episode_of_movie_slug,
      episodes_progress: updatedEpisodesProgress,
      is_finished: isMovieCompletelyFinished,
      updated_at: new Date().toISOString(),
    };

    await redis.hset(key, {
      [payload.movie_slug]: JSON.stringify(updatedHistoryItem),
    });
    await redis.expire(key, HISTORY_CACHE_TTL);
  } catch (error) {
    console.error("Error updating history cache:", error);
  }
};

export const getHistoryCache = async (userId?: string, deviceId?: string) => {
  const key = getHistoryCacheKey(userId, deviceId);
  if (!key) return null;

  try {
    if (!redis) {
      console.warn("Redis not initialized. Cannot get history cache.");
      return null;
    }
    const history = await redis.hgetall(key);
    if (!history) return null;

    const parsedHistory: Record<string, HistoryItem> = {};
    for (const movieSlug in history) {
      try {
        const val = history[movieSlug];
        parsedHistory[movieSlug] =
          typeof val === "string"
            ? JSON.parse(val)
            : (val as unknown as HistoryItem);
      } catch (e) {
        console.error(`Error parsing: ${movieSlug}`, e);
      }
    }
    return parsedHistory;
  } catch (error) {
    console.error("Error getting history cache:", error);
    return null;
  }
};
