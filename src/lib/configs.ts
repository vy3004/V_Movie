export const BASE_URL = process.env.NEXT_PUBLIC_PORT;
const BASE_MOVIE_API = process.env.NEXT_PUBLIC_MOVIE_API;
const BASE_IMG_API = process.env.NEXT_PUBLIC_IMG_API;

export const WEB_TITLE = "V · Movie";

export const apiConfig = {
  SEARCH_URL: `${BASE_MOVIE_API}/`,
  MOVIES_URL: `${BASE_MOVIE_API}/danh-sach/`,
  MOVIE_URL: `${BASE_MOVIE_API}/phim/`,
  CATEGORIES_URL: `${BASE_MOVIE_API}/the-loai/`,
  COUNTRIES_URL: `${BASE_MOVIE_API}/quoc-gia/`,
  IMG_URL: `https://wsrv.nl/?output=webp&q=75&url=${BASE_IMG_API}/uploads/movies/`,
};

export const typesMovie = {
  NEW: { name: "Phim mới", slug: "phim-moi-cap-nhat" },
  SINGLE: { name: "Phim lẻ", slug: "phim-le" },
  SERIES: { name: "Phim bộ", slug: "phim-bo" },
  TV_SHOWS: { name: "TV Shows", slug: "tv-shows" },
  ANIME: { name: "Hoạt hình", slug: "hoat-hinh" },
  VIETSUB: { name: "Phim Vietsub", slug: "phim-vietsub" },
  THUYET_MINH: { name: "Phim thuyết minh", slug: "phim-thuyet-minh" },
  LONG_TIENG: { name: "Phim lồng tiếng", slug: "phim-long-tieng" },
};
