import { normalizeSearchText } from "@/services/movie-sources/utils";

export function buildMovieSearchParams(keyword: string, limit = 24): { keyword: string; limit: number } {
  return {
    keyword: normalizeSearchText(keyword),
    limit: Math.min(Math.max(limit, 1), 48),
  };
}
