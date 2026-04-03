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

export const GUEST_HISTORY_KEY = "v_movie_guest_history";

export const saveLocalHistory = (item: any) => {
  if (typeof window === "undefined") return;
  const GUEST_KEY = "v_movie_guest_history";
  const history = JSON.parse(localStorage.getItem(GUEST_KEY) || "[]");

  const movieIndex = history.findIndex(
    (h: any) => h.movieSlug === item.movieSlug,
  );
  let movieData =
    movieIndex > -1
      ? history[movieIndex]
      : {
          movieSlug: item.movieSlug,
          movieName: item.movieName,
          moviePoster: item.moviePoster,
          episodes_progress: {},
        };

  const isFinishedCurrent = item.lastTime > item.duration * 0.95;

  // Cập nhật tiến trình tập hiện tại
  movieData.episodes_progress[item.episodeSlug] = {
    lastTime: item.lastTime,
    duration: item.duration,
    isFinished: isFinishedCurrent,
    updated_at: new Date().toISOString(),
  };

  // Dự đoán tập tiếp theo cho Local
  movieData.last_episode_slug =
    isFinishedCurrent && item.nextEpisodeSlug
      ? item.nextEpisodeSlug
      : item.episodeSlug;

  movieData.is_finished = isFinishedCurrent && !item.nextEpisodeSlug;
  movieData.updated_at = new Date().toISOString();

  if (movieIndex > -1) history.splice(movieIndex, 1);
  const newHistory = [movieData, ...history].slice(0, 20);
  localStorage.setItem(GUEST_KEY, JSON.stringify(newHistory));
  window.dispatchEvent(new Event("local-history-updated"));
};

export const getLocalHistory = () => {
  if (typeof window === "undefined") return [];
  return JSON.parse(localStorage.getItem("v_movie_guest_history") || "[]");
};

export const formatDuration = (seconds: number) => {
  if (!seconds || seconds <= 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};
