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
