import { MovieSource } from "@/types/movie";

export type IndexJobMode = "backfill" | "incremental";
export type IndexJobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type ReviewStatus = "pending" | "merged" | "kept_separate" | "ignored";
export type MergeAction = "merge" | "split" | "keep_separate" | "ignore";
export type EpisodeState = "trailer" | "full" | "ongoing" | "completed" | "unknown";

export interface IndexedMovieSourceRef {
  source: MovieSource;
  slug: string;
  content_hash: string;
}

export interface SourceMovieCardInput {
  source: MovieSource;
  slug: string;
  name: string;
  origin_name?: string | null;
  episode_current?: string | null;
  year?: number | string | null;
  type?: string | null;
  status?: string | null;
  thumb_url?: string | null;
  poster_url?: string | null;
  quality?: string | null;
  lang?: string | null;
  category_slugs?: string[];
  country_slugs?: string[];
  season?: number | string | null;
  vote_average?: number | string | null;
  vote_count?: number | string | null;
  updated_at?: string | null;
}

export interface IndexedSourceSnapshot extends SourceMovieCardInput {
  origin_name: string;
  episode_current: string;
  year: number | null;
  type: string;
  normalized_name: string;
  normalized_origin_name: string;
  search_text: string;
  dedupe_key: string;
  episode_number: number;
  episode_state: EpisodeState;
  season: number | null;
  source_vote_average: number | null;
  source_vote_count: number;
  vote_average: number | null;
  vote_count: number;
  popularity_score: number;
  content_hash: string;
}

export interface IndexedMovie {
  id: string;
  slug: string;
  name: string;
  origin_name: string | null;
  normalized_name: string;
  normalized_origin_name: string | null;
  search_text: string;
  dedupe_key: string;
  year: number | null;
  type: string | null;
  status: string | null;
  thumb_url: string | null;
  poster_url: string | null;
  episode_current: string | null;
  episode_number: number;
  episode_state: EpisodeState;
  season: number | null;
  quality: string | null;
  lang: string | null;
  category_slugs: string[];
  country_slugs: string[];
  source_vote_average: number | null;
  source_vote_count: number;
  vote_average: number | null;
  vote_count: number;
  popularity_score: number;
  sources: IndexedMovieSourceRef[];
  primary_source: MovieSource | null;
  primary_source_slug: string | null;
  merge_status: string;
  content_hash: string | null;
  last_synced_at: string | null;
}
