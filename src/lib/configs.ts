const BASE_IMG_API = process.env.NEXT_PUBLIC_IMG_API;

export const BASE_MOVIE_API = process.env.NEXT_PUBLIC_MOVIE_API!;
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const BASE_URL = process.env.NEXT_PUBLIC_PORT!;
export const WEB_TITLE = "V · Movie";

export const WSRV_PROXY = "https://wsrv.nl";
export const MOVIE_IMG_PATH = `${BASE_IMG_API}/uploads/movies/`;

export const apiConfig = {
  SEARCH_URL: `${BASE_MOVIE_API}/`,
  MOVIES_URL: `${BASE_MOVIE_API}/danh-sach/`,
  MOVIE_URL: `${BASE_MOVIE_API}/phim/`,
  CATEGORIES_URL: `${BASE_MOVIE_API}/the-loai/`,
  COUNTRIES_URL: `${BASE_MOVIE_API}/quoc-gia/`
};

export const typesMovie = {
  NEW: { name: "Phim mới", slug: "phim-moi-cap-nhat" },
  CHIEU_RAP: { name: "Phim chiếu rạp", slug: "phim-chieu-rap" },
  SINGLE: { name: "Phim lẻ", slug: "phim-le" },
  SERIES: { name: "Phim bộ", slug: "phim-bo" },
  TV_SHOWS: { name: "TV Shows", slug: "tv-shows" },
  ANIME: { name: "Hoạt hình", slug: "hoat-hinh" },
  VIETSUB: { name: "Phim Vietsub", slug: "phim-vietsub" },
  THUYET_MINH: { name: "Phim thuyết minh", slug: "phim-thuyet-minh" },
  LONG_TIENG: { name: "Phim lồng tiếng", slug: "phim-long-tieng" },
};
