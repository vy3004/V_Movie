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

interface Pagination {
  totalItems: number;
  totalItemsPerPage: number;
  currentPage: number;
  pageRanges: number;
}

interface Params {
  type_slug: string;
  filterCategory: string[];
  filterCountry: string[];
  filterYear: string;
  filterType: string;
  sortField: string;
  sortType: string;
  pagination: Pagination;
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
  params: Params;
}

export interface PageMovieData {
  seoOnPage: SeoOnPage;
  breadCrumb: BreadCrumb[];
  params: { slug: string };
  item: Movie | null;
}

export interface EpisodeProgress {
  ep_last_time: number;
  ep_duration: number;
  ep_is_finished: boolean;
  ep_updated_at: string;
}

export interface HistoryItem {
  id?: string;
  user_id?: string;
  device_id?: string;
  movie_slug: string;
  movie_name: string;
  movie_poster: string;
  last_episode_slug: string;
  last_episode_of_movie_slug: string;
  episodes_progress: Record<string, EpisodeProgress>;
  is_finished: boolean;
  updated_at: string;
}

export interface HistoryUpdatePayload {
  user_id?: string;
  device_id?: string;
  movie_slug: string;
  movie_name?: string;
  movie_poster?: string;
  last_episode_slug: string;
  last_episode_of_movie_slug: string;
  current_time: number;
  duration: number;
}

export interface DeviceId {
  id: string;
  isGuest: boolean;
}

export interface SubscriptionItem {
  user_id?: string;
  movie_slug: string;
  movie_name: string;
  movie_poster: string;
  movie_status: string; // "trailer", "ongoing", "complete"
  last_known_episode_slug: string;
  has_new_episode: boolean;
  created_at?: string;
  updated_at?: string;
}

export type NotificationType =
  | "new_episode"
  | "comment_reply"
  | "comment_like"
  | "system";

export interface NotificationItem {
  id: string;
  user_id: string;
  type: NotificationType;
  movie_slug?: string;
  movie_name?: string;
  actor_name?: string;
  content: string;
  is_read: boolean;
  metadata?: {
    episode?: string;
    comment_id?: string;
    [key: string]: unknown;
  };
  created_at: string;
}

export interface CommentItem {
  id: string;
  movie_slug: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  likes_count: number;
  replies_count: number;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
  // Được JOIN từ bảng profiles
  profiles?: {
    full_name: string;
    avatar_url: string;
  };
  // Thuộc tính ảo (Virtual field) để Frontend tự theo dõi trạng thái Like
  is_liked_by_me?: boolean;
  // Dùng để đánh dấu comment giả tạo ra để cập nhật UI ngay lập tức
  isOptimistic?: boolean;
}

export interface SupabaseRawComment extends Omit<
  CommentItem,
  "replies_count" | "is_liked_by_me"
> {
  replies_count: { count: number }[];
}
