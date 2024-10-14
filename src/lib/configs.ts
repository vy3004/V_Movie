export const menuConfig = [
  {
    name: "Phim lẻ",
    slug: "/phim-le",
  },
  {
    name: "Phim bộ",
    slug: "/phim-bo",
  },
  {
    name: "Truyền hình",
    slug: "/tv-shows",
  },
  {
    name: "Hoạt hình",
    slug: "/hoat-hinh",
  },
];

export const WEB_TITLE = "V · Movie";

export const apiConfig = {
  MOVIES_URL: `${process.env.NEXT_PUBLIC_MOVIE_API}/danh-sach/`,
  MOVIE_URL: `${process.env.NEXT_PUBLIC_MOVIE_API}/phim/`,
  CATEGORIES_URL: `${process.env.NEXT_PUBLIC_MOVIE_API}/the-loai/`,
  COUNTRIES_URL: `${process.env.NEXT_PUBLIC_MOVIE_API}/quoc-gia/`,
  IMG_URL: `${process.env.NEXT_PUBLIC_IMG_API}/uploads/movies/`,
};

export const pathNameMovies = {
  NEW: "phim-moi-cap-nhat",
  SINGLE: "/phim-le",
  SERIES: "/phim-bo",
  TV_SHOWS: "/tv-shows",
  ANIME: "/hoat-hinh",
};
