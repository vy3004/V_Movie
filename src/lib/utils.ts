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
      path.split("/the-loai/")[1]
    )}`;
  if (path.startsWith("/quoc-gia/"))
    return `/phim-moi-cap-nhat?country=${encodeURIComponent(
      path.split("/quoc-gia/")[1]
    )}`;
  return path;
};
