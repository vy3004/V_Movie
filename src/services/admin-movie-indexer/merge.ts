import { IndexedMovie, IndexedMovieSourceRef, IndexedSourceSnapshot } from "@/types";
import { buildContentHash, buildSearchText, buildSourceRef } from "@/services/admin-movie-indexer/utils";

const SOURCE_PRIORITY: Record<IndexedSourceSnapshot["source"], number> = {
  ophim: 3,
  phimapi: 2,
};

export type MergeDecision = "auto_merge" | "needs_review" | "keep_separate";

export function classifyCandidate(
  existing: IndexedSourceSnapshot,
  incoming: IndexedSourceSnapshot,
): { decision: MergeDecision; reason: string; confidence: number } {
  if (!existing.year || !incoming.year) {
    return { decision: "needs_review", reason: "missing_year", confidence: 60 };
  }

  if (
    existing.normalized_origin_name &&
    incoming.normalized_origin_name &&
    existing.normalized_origin_name === incoming.normalized_origin_name &&
    existing.year === incoming.year &&
    existing.type === incoming.type
  ) {
    return { decision: "auto_merge", reason: "origin_year_type_match", confidence: 98 };
  }

  if (existing.year !== incoming.year || existing.type !== incoming.type) {
    return { decision: "keep_separate", reason: "year_or_type_differs", confidence: 20 };
  }

  if (existing.normalized_name === incoming.normalized_name) {
    return { decision: "needs_review", reason: "name_match_origin_differs", confidence: 75 };
  }

  return { decision: "keep_separate", reason: "not_similar", confidence: 0 };
}

export function pickPrimarySource(sources: IndexedSourceSnapshot[]): IndexedSourceSnapshot | null {
  return [...sources].sort((a, b) => sourceScore(b) - sourceScore(a))[0] ?? null;
}

function sourceScore(source: IndexedSourceSnapshot): number {
  return (
    source.episode_number * 10 +
    (source.poster_url ? 5 : 0) +
    (source.thumb_url ? 3 : 0) +
    SOURCE_PRIORITY[source.source]
  );
}

function mergeSourceRefs(sources: IndexedMovieSourceRef[], incoming: IndexedSourceSnapshot): IndexedMovieSourceRef[] {
  return [
    ...sources.filter((item) => !(item.source === incoming.source && item.slug === incoming.slug)),
    buildSourceRef(incoming),
  ];
}

function publicContentHash(movie: Pick<IndexedMovie, "name" | "origin_name" | "year" | "type" | "thumb_url" | "poster_url" | "episode_current" | "episode_number" | "episode_state" | "season" | "quality" | "lang" | "category_slugs" | "country_slugs" | "vote_average" | "vote_count">): string {
  return buildContentHash({
    name: movie.name,
    origin_name: movie.origin_name || "",
    year: movie.year,
    type: movie.type || "",
    thumb_url: movie.thumb_url || "",
    poster_url: movie.poster_url || "",
    episode_current: movie.episode_current || "",
    episode_number: movie.episode_number,
    episode_state: movie.episode_state,
    season: movie.season,
    quality: movie.quality || "",
    lang: movie.lang || "",
    category_slugs: movie.category_slugs,
    country_slugs: movie.country_slugs,
    vote_average: movie.vote_average,
    vote_count: movie.vote_count,
  });
}

export function mergeSourceIntoMovie(
  existing: IndexedSourceSnapshot | IndexedMovie,
  incoming: IndexedSourceSnapshot,
): IndexedMovie {
  const existingMovie = "sources" in existing ? existing : null;
  const primary = pickPrimarySource([incoming]);
  const bestEpisode = existingMovie && existingMovie.episode_number > incoming.episode_number ? existingMovie : incoming;
  const nextSources = mergeSourceRefs(existingMovie?.sources || [], incoming);
  const nextMovie = {
    id: existingMovie?.id || "",
    slug: existing.slug,
    name: primary?.name ?? incoming.name,
    origin_name: primary?.origin_name ?? incoming.origin_name,
    normalized_name: primary?.normalized_name ?? incoming.normalized_name,
    normalized_origin_name: primary?.normalized_origin_name ?? incoming.normalized_origin_name,
    search_text: buildSearchText([existingMovie?.search_text, incoming.search_text]),
    dedupe_key: primary?.dedupe_key ?? incoming.dedupe_key,
    year: primary?.year ?? incoming.year,
    type: primary?.type ?? incoming.type,
    status: primary?.status ?? incoming.status ?? null,
    thumb_url: primary?.thumb_url ?? incoming.thumb_url ?? null,
    poster_url: primary?.poster_url ?? incoming.poster_url ?? null,
    episode_current: bestEpisode.episode_current,
    episode_number: bestEpisode.episode_number,
    episode_state: bestEpisode.episode_state,
    season: primary?.season ?? incoming.season,
    quality: primary?.quality ?? incoming.quality ?? null,
    lang: primary?.lang ?? incoming.lang ?? null,
    category_slugs: primary?.category_slugs ?? [],
    country_slugs: primary?.country_slugs ?? [],
    source_vote_average: primary?.source_vote_average ?? incoming.source_vote_average,
    source_vote_count: primary?.source_vote_count ?? incoming.source_vote_count,
    vote_average: primary?.vote_average ?? incoming.vote_average,
    vote_count: primary?.vote_count ?? incoming.vote_count,
    popularity_score: primary?.popularity_score ?? incoming.popularity_score,
    sources: nextSources,
    primary_source: primary?.source ?? null,
    primary_source_slug: primary?.slug ?? null,
    merge_status: "merged",
    content_hash: incoming.content_hash,
    last_synced_at: new Date().toISOString(),
  } satisfies IndexedMovie;

  return { ...nextMovie, content_hash: publicContentHash(nextMovie) };
}

