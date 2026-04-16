import { SeoOnPage, BreadCrumb } from "./seo";
import { Pagination, CateCtr } from "./common";

export interface ServerData {
  name: string;
  slug: string;
  filename: string;
  link_embed: string;
  link_m3u8: string;
}

export interface Episode {
  server_name: string;
  server_data: ServerData[];
}

export interface Movie {
  tmdb: {
    type: string;
    id: string;
    season: string | null;
    vote_average: number;
    vote_count: number;
  };
  imdb: { id: string };
  created: { time: string };
  modified: { time: string };
  _id: string;
  name: string;
  slug: string;
  origin_name: string;
  content: string;
  type: string;
  status: string;
  thumb_url: string;
  poster_url: string;
  trailer_url: string;
  is_copyright: boolean;
  sub_docquyen: boolean;
  chieurap: boolean;
  time: string;
  episode_current: string;
  episode_total: string;
  quality: string;
  lang: string;
  year: number;
  view: number;
  actor: string[];
  director: string[];
  category: CateCtr[];
  country: CateCtr[];
  episodes: Episode[];
}

export interface PageMoviesData {
  seoOnPage: SeoOnPage;
  breadCrumb: BreadCrumb[];
  titlePage: string;
  items: Movie[];
  params: {
    type_slug: string;
    filterCategory: string[];
    filterCountry: string[];
    filterYear: string;
    filterType: string;
    sortField: string;
    sortType: string;
    pagination: Pagination;
  };
}

export interface PageMovieData {
  seoOnPage: SeoOnPage;
  breadCrumb: BreadCrumb[];
  params: { slug: string };
  item: Movie | null;
}

export interface MovieQueryParams {
  slug?: string;
  page?: number | string;
  limit?: number | string;
  sort_field?: string;
  sort_type?: string;
  category?: string;
  country?: string;
  year?: string | number;
}
