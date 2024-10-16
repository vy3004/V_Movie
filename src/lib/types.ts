export interface CateCtr {
  _id?: string;
  name: string;
  slug: string;
}

interface SeoSchema {
  "@context": string;
  "@type": string;
  name: string;
  dateModified: string;
  dateCreated: string;
  url: string;
  datePublished: string;
  image: string;
  director: string;
}

interface SeoOnPage {
  titleHead: string;
  descriptionHead: string;
  seoSchema?: SeoSchema;
  og_type: string;
  og_image: string[];
  og_url: string;
}

export interface BreadCrumb {
  name: string;
  slug?: string;
  isCurrent?: boolean;
  position: number;
}

interface Tmdb {
  type: string;
  id: string;
  season: string | null;
  vote_average: number;
  vote_count: number;
}

interface Imdb {
  id: string;
}

interface Time {
  time: string;
}

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
  tmdb: Tmdb;
  imdb: Imdb;
  created: Time;
  modified: Time;
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
}

export interface PageMovieData {
  seoOnPage: SeoOnPage;
  breadCrumb: BreadCrumb[];
  params: { slug: string };
  item: Movie | null;
}
