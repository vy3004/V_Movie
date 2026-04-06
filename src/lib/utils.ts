import { HistoryItem, EpisodeProgress } from "@/lib/types";

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
