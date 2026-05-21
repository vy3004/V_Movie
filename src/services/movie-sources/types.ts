import { Movie, MovieSource, PageMovieData, PageMoviesData } from "@/types";

export type { MovieSource };

export const MOVIE_SOURCES: MovieSource[] = ["ophim", "phimapi"];

export interface MovieSourceProvider {
  source: MovieSource;
  search(keyword: string, page: number, limit: number): Promise<PageMoviesData>;
  getDetail(slug: string): Promise<PageMovieData>;
  findCandidates(movie: Movie, limit?: number): Promise<Movie[]>;
}

export interface ModalSearchCursor {
  pages: Record<MovieSource, number>;
  exhausted: Record<MovieSource, boolean>;
  seenKeys: string[];
  returned: number;
  phase?: "db" | "fallback";
  dbPage?: number;
}

export interface ModalSearchResponse extends PageMoviesData {
  nextCursor: ModalSearchCursor | null;
  searchPhase?: "db" | "fallback" | "done";
  isFallbackSearching?: boolean;
}

