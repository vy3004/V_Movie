import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import sanitizeHtmlLib from "sanitize-html";
import { redis } from "@/lib/redis";
import {
  Movie,
  HistoryItem,
  SubscriptionItem,
  EpisodeProgress,
  HistoryUpdatePayload,
} from "@/types";

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

export const formatDuration = (seconds: number) => {
  if (!seconds || seconds <= 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

export const formatEpisodeName = (
  input: string,
  has_new_episode: boolean | string,
): string => {
  if (has_new_episode === true || String(has_new_episode) === "true")
    return "Tập Mới";

  if (/^\d+$/.test(input)) return `Tập ${input}`;

  return input;
};

/**
 * Format thời gian sang dạng: "5 phút trước", "2 ngày trước"
 */
export const formatTimeAgo = (date: string | Date): string => {
  if (!date) return "";
  return formatDistanceToNow(new Date(date), {
    addSuffix: true,
    locale: vi,
  });
};

/**
 * Helper xáo trộn phim (Fisher-Yates shuffle)
 */
export const shuffleMovies = (items: Movie[]): Movie[] => {
  if (!items.length) return [];

  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Format tên phim: Tên chính + Tên phụ
export const formatMovieTitle = (
  name: string,
  originName?: string,
): [string, string] => {
  if (!name) return ["", ""];

  // Regex 1: Tìm cụm "(Phần X)" không phân biệt hoa thường
  const seasonRegex: RegExp = /\s*\(phần\s*(\d+)\)/i;

  // Regex 2: Tìm dấu ":" hoặc "," hoặc " - "
  const separatorMatch: RegExpMatchArray | null = name.match(/[:,]|\s-\s/);

  // TRƯỜNG HỢP 1: CÓ DẤU ":", ",", HOẶC " - "
  // Kiểm tra thêm .index !== undefined để TypeScript hiểu đây chắc chắn là number
  if (separatorMatch && separatorMatch.index !== undefined) {
    const splitIdx: number = separatorMatch.index;
    const separatorLength: number = separatorMatch[0].length;

    // Cắt lấy phần trước và sau dấu phân cách
    const part1: string = name.slice(0, splitIdx).trim();
    let part2: string = name.slice(splitIdx + separatorLength).trim();

    // Nếu chuỗi phụ có "(Phần X)", thay thế thành " X"
    part2 = part2.replace(seasonRegex, " $1").trim();

    return [part1, part2];
  }

  // TRƯỜNG HỢP 2: KHÔNG CÓ DẤU PHÂN CÁCH, NHƯNG CÓ "(PHẦN X)"
  const seasonMatch: RegExpMatchArray | null = name.match(seasonRegex);
  if (seasonMatch && seasonMatch.index !== undefined) {
    const splitIdx: number = seasonMatch.index;
    const part1: string = name.slice(0, splitIdx).trim();
    const part2: string = `season ${seasonMatch[1]}`;
    return [part1, part2];
  }

  // TRƯỜNG HỢP 3: BÌNH THƯỜNG
  return [name.trim(), (originName || "").trim()];
};

export const escapeSearchPattern = (value: string): string => {
  return value
    .replace(/[%_]/g, "\\$&") // Escape SQL LIKE wildcards
    .replace(/[,()]/g, ""); // Remove PostgREST special chars
};

// --- WEB PUSH ---
// Trình duyệt yêu cầu Public Key phải được mã hóa sang dạng Uint8Array
export const urlBase64ToUint8Array = (base64String: string) => {
  if (typeof window === "undefined") {
    throw new Error(
      "urlBase64ToUint8Array can only be used in browser environment",
    );
  }
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
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

// ==========================================
// SUBSCRIPTIONS (THEO DÕI PHIM) HELPERS
// ==========================================

const GUEST_SUBS_KEY = "v_movie_guest_subscriptions";

/**
 * 1. Đọc danh sách phim theo dõi từ LocalStorage (Dành cho Guest)
 */
export const getLocalSubscriptions = (): SubscriptionItem[] => {
  if (typeof window === "undefined") return [];

  try {
    const rawData = localStorage.getItem(GUEST_SUBS_KEY);
    if (!rawData) return [];

    const parsedData = JSON.parse(rawData);

    // Kiểm tra tính hợp lệ của dữ liệu (bảo vệ khỏi việc user tự sửa bậy trong DevTools)
    if (Array.isArray(parsedData)) {
      return parsedData.filter(
        (item): item is SubscriptionItem =>
          item !== null &&
          typeof item === "object" &&
          typeof item.movie_slug === "string",
      );
    }
    return [];
  } catch (error) {
    console.error(
      "[LocalStorage] Cảnh báo: Lỗi đọc dữ liệu Subscriptions.",
      error,
    );
    // Nếu lỗi (ví dụ JSON.parse fail), xóa dữ liệu cũ để tránh lỗi liên hoàn
    localStorage.removeItem(GUEST_SUBS_KEY);
    return [];
  }
};

/**
 * 2. Thêm/Xóa phim khỏi danh sách theo dõi trong LocalStorage
 * Trả về: true (nếu mới thêm), false (nếu vừa xóa)
 * Đồng thời bắn ra event "subscription-updated" để đồng bộ UI
 */
export const toggleLocalSubscription = (item: SubscriptionItem): boolean => {
  if (typeof window === "undefined") return false;

  try {
    const currentSubs = getLocalSubscriptions();
    const isCurrentlyFollowed = currentSubs.some(
      (s) => s.movie_slug === item.movie_slug,
    );

    let newSubs: SubscriptionItem[];

    if (isCurrentlyFollowed) {
      newSubs = currentSubs.filter((s) => s.movie_slug !== item.movie_slug);
    } else {
      const newItem: SubscriptionItem = {
        ...item,
        updated_at: new Date().toISOString(),
      };
      newSubs = [newItem, ...currentSubs];
    }

    localStorage.setItem(GUEST_SUBS_KEY, JSON.stringify(newSubs));

    return !isCurrentlyFollowed;
  } catch (error) {
    console.error(
      "[LocalStorage] Cảnh báo: Lỗi lưu dữ liệu Subscription.",
      error,
    );
    return false;
  }
};

/**
 * Làm sạch chuỗi HTML, chống XSS Attack
 */
export function sanitizeHtml(dirtyHtml: string): string {
  if (!dirtyHtml) return "";

  return sanitizeHtmlLib(dirtyHtml, {
    // Chỉ cho phép các thẻ định dạng cơ bản trong Comment
    allowedTags: [
      "b",
      "i",
      "em",
      "strong",
      "a",
      "p",
      "br",
      "span",
      "ul",
      "ol",
      "li",
    ],

    // Chỉ cho phép các thuộc tính an toàn
    allowedAttributes: {
      a: ["href", "target", "rel"],
    },

    // Cấu hình an toàn cho thẻ a
    transformTags: {
      a: sanitizeHtmlLib.simpleTransform("a", {
        target: "_blank",
        rel: "noopener noreferrer",
      }),
    },

    // KHÔNG cho phép iframe (chống chèn video lạ/mã độc)
    allowedIframeHostnames: [],
  });
}
