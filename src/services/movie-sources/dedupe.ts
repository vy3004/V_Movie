import { Movie, MovieSource } from "@/types";
import { normalizeSearchText } from "./utils";

const SOURCE_PRIORITY: Record<MovieSource, number> = {
  ophim: 0,
  phimapi: 1,
};

export function getMovieDedupeKey(movie: Movie): string {
  return [
    normalizeSearchText(movie.origin_name),
    normalizeSearchText(movie.name),
    movie.year || "",
    movie.type || "",
  ].join("|");
}

function priority(movie: Movie): number {
  return SOURCE_PRIORITY[movie.source || "ophim"] ?? 99;
}

export function dedupeMovies(items: Movie[], seenKeys: Set<string> = new Set()): Movie[] {
  const byKey = new Map<string, Movie>();

  for (const item of items) {
    const key = getMovieDedupeKey(item);
    if (!key.replace(/\|/g, "")) continue;
    if (seenKeys.has(key)) continue;

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...item, sources: item.source ? [item.source] : item.sources || [] });
      continue;
    }

    const sources = Array.from(
      new Set([...(existing.sources || []), ...(item.sources || []), item.source].filter(Boolean) as MovieSource[]),
    ).sort((a, b) => priority({ ...existing, source: a }) - priority({ ...existing, source: b }));

    const winner = priority(item) < priority(existing) ? item : existing;
    byKey.set(key, { ...winner, sources });
  }

  return Array.from(byKey.values()).sort((a, b) => priority(a) - priority(b));
}

