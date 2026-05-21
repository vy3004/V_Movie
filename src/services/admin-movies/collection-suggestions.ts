import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/services/admin-movie-indexer/admin.service";
import { normalizeSearchText } from "@/services/movie-sources/utils";
import type { IndexedMovie, IndexedMovieSourceRef } from "@/types/admin-movie-indexer";

const MAX_SEEDS = 50;
const MAX_CANDIDATES_PER_SEED = 60;
const MIN_ITEM_SCORE = 70;
const REVIEW_SCORE = 85;
const MIN_TITLE_TOKEN_LENGTH = 3;

type CollectionRecord = {
  id: string;
  slug: string;
  name: string;
};

type CandidateMovie = Pick<
  IndexedMovie,
  | "id"
  | "slug"
  | "name"
  | "origin_name"
  | "normalized_name"
  | "normalized_origin_name"
  | "year"
  | "type"
  | "season"
  | "episode_number"
  | "episode_current"
  | "category_slugs"
  | "country_slugs"
  | "sources"
> & {
  is_blocked?: boolean | null;
};

export type CollectionSuggestionItem = {
  movie_id: string;
  slug: string;
  label: string;
  item_type: string;
  sort_order: number;
  confidence: number;
  reason: string;
  movie: CandidateMovie;
};

export type CollectionSuggestion = {
  name: string;
  slug: string;
  confidence: number;
  reason: string;
  existingCollection: CollectionRecord | null;
  items: CollectionSuggestionItem[];
};

function escapeIlikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&").replace(/,/g, "\\,");
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function baseTitle(movie: Pick<CandidateMovie, "name" | "origin_name" | "normalized_name" | "normalized_origin_name">) {
  const raw = movie.normalized_origin_name || movie.normalized_name || normalizeSearchText(movie.origin_name || movie.name);
  return raw
    .replace(/\b(season|part|movie|ova|special|live action)\b\s*\d*/g, " ")
    .replace(/\b(ss|s)\s*\d+\b/g, " ")
    .replace(/\b(phan|mua|tap)\s*\d*\b/g, " ")
    .replace(/\b\d{4}\b/g, " ")
    .replace(/\b\d+\b/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function titleTokens(value: string) {
  return value.split(" ").filter((token) => token.length >= MIN_TITLE_TOKEN_LENGTH);
}

function franchiseTokens(movie: Pick<CandidateMovie, "name" | "origin_name" | "normalized_name" | "normalized_origin_name">) {
  return unique(titleTokens(baseTitle(movie)));
}

function containsToken(value: string | null | undefined, token: string) {
  const normalized = ` ${normalizeSearchText(value || "")} `;
  return normalized.includes(` ${token} `) || normalized.includes(` ${token}s `);
}

function hasFranchiseToken(movie: Pick<CandidateMovie, "name" | "origin_name" | "normalized_name" | "normalized_origin_name">, tokens: string[]) {
  const fields = [movie.normalized_name, movie.normalized_origin_name, normalizeSearchText(movie.name), normalizeSearchText(movie.origin_name || "")];
  return tokens.some((token) => fields.some((field) => containsToken(field, token)));
}

function slugify(value: string) {
  return normalizeSearchText(value).replace(/\s+/g, "-").replace(/^-+|-+$/g, "");
}

function itemType(movie: CandidateMovie) {
  if (movie.season) return "season";
  if (movie.type === "series") return "tv_series";
  if (movie.type === "hoathinh") return "movie";
  return movie.type === "single" ? "movie" : "other";
}

function overlapScore(left: string[] | null | undefined, right: string[] | null | undefined) {
  const leftSet = new Set(left || []);
  return (right || []).filter((item) => leftSet.has(item)).length;
}

function sourceTokens(movie: CandidateMovie) {
  return unique((movie.sources || []).flatMap((source: IndexedMovieSourceRef) => [source.source, source.slug]).filter((value): value is string => Boolean(value)));
}

function scoreCandidate(seed: CandidateMovie, candidate: CandidateMovie) {
  const seedBase = baseTitle(seed);
  const candidateBase = baseTitle(candidate);
  const seedOrigin = seed.normalized_origin_name || "";
  const candidateOrigin = candidate.normalized_origin_name || "";
  const seedTokens = franchiseTokens(seed);
  const tokenMatch = seedTokens.length > 0 && hasFranchiseToken(candidate, seedTokens);
  const exactOriginMatch = Boolean(seedOrigin && candidateOrigin && seedOrigin === candidateOrigin);
  const exactBaseMatch = Boolean(seedBase && candidateBase && seedBase === candidateBase);
  let score = 0;
  const reasons: string[] = [];

  if (candidate.is_blocked) return { score: 0, reason: "blocked movie" };
  if (seed.category_slugs?.includes("phim-18") !== candidate.category_slugs?.includes("phim-18")) return { score: 0, reason: "adult mismatch" };

  if (seed.id === candidate.id) {
    score += 100;
    reasons.push("selected movie");
  }
  if (exactOriginMatch) {
    score += 80;
    reasons.push("origin match");
  }
  if (exactBaseMatch) {
    score += 70;
    reasons.push("base title match");
  } else if (tokenMatch) {
    score += 55;
    reasons.push("franchise token match");
  }

  if (!exactOriginMatch && !exactBaseMatch && !tokenMatch) return { score: 0, reason: "no franchise title match" };

  if (seed.type && candidate.type && seed.type === candidate.type) score += 10;
  const taxonomyOverlap = overlapScore(seed.category_slugs, candidate.category_slugs) + overlapScore(seed.country_slugs, candidate.country_slugs);
  if (taxonomyOverlap) score += Math.min(8, taxonomyOverlap * 4);
  if (sourceTokens(seed).some((token) => sourceTokens(candidate).includes(token))) score += 5;
  if (seed.year && candidate.year && seed.year !== candidate.year && !exactOriginMatch && !exactBaseMatch) score -= 30;

  return {
    score: Math.max(0, Math.min(100, score)),
    reason: reasons.join(", ") || "weak metadata match",
  };
}

function sortItems(left: CollectionSuggestionItem, right: CollectionSuggestionItem) {
  return (
    (left.movie.year || 0) - (right.movie.year || 0) ||
    (left.movie.season || 0) - (right.movie.season || 0) ||
    left.movie.episode_number - right.movie.episode_number ||
    left.label.localeCompare(right.label)
  );
}

function buildSuggestionName(seedMovies: CandidateMovie[]) {
  const origin = seedMovies.find((movie) => movie.origin_name)?.origin_name;
  return origin || seedMovies[0]?.name || "Movie Collection";
}

function findExistingCollection(collections: CollectionRecord[], slug: string, name: string) {
  const normalizedName = normalizeSearchText(name);
  return collections.find((collection) => collection.slug === slug || normalizeSearchText(collection.name) === normalizedName) || null;
}

async function loadCandidateRows(seed: CandidateMovie) {
  const base = baseTitle(seed);
  const escapedBase = escapeIlikePattern(base);
  const selectFields = "id,slug,name,origin_name,normalized_name,normalized_origin_name,year,type,season,episode_number,episode_current,category_slugs,country_slugs,sources,is_blocked";
  const queries = [];

  if (base.length >= MIN_TITLE_TOKEN_LENGTH) {
    queries.push(
      supabaseAdmin
        .from("movies")
        .select(selectFields)
        .eq("is_blocked", false)
        .ilike("normalized_name", `%${escapedBase}%`)
        .limit(MAX_CANDIDATES_PER_SEED),
      supabaseAdmin
        .from("movies")
        .select(selectFields)
        .eq("is_blocked", false)
        .ilike("normalized_origin_name", `%${escapedBase}%`)
        .limit(MAX_CANDIDATES_PER_SEED),
    );
  }

  if (seed.normalized_origin_name) {
    queries.push(
      supabaseAdmin
        .from("movies")
        .select(selectFields)
        .eq("is_blocked", false)
        .eq("normalized_origin_name", seed.normalized_origin_name)
        .limit(MAX_CANDIDATES_PER_SEED),
    );
  }

  const results = await Promise.all(queries);
  for (const result of results) if (result.error) throw result.error;
  return results.flatMap((result) => (result.data || []) as CandidateMovie[]);
}

async function loadCandidates(seedMovies: CandidateMovie[]) {
  const byId = new Map<string, CandidateMovie>();

  for (const seed of seedMovies) {
    for (const movie of await loadCandidateRows(seed)) byId.set(movie.id, movie);
  }

  for (const seed of seedMovies) byId.set(seed.id, seed);
  return Array.from(byId.values());
}

export function buildCollectionSuggestion(
  seedMovies: CandidateMovie[],
  candidates: CandidateMovie[],
  existingCollections: CollectionRecord[],
): CollectionSuggestion | null {
  if (!seedMovies.length) return null;

  const bestById = new Map<string, CollectionSuggestionItem>();
  for (const candidate of candidates) {
    const scored = seedMovies
      .map((seed) => scoreCandidate(seed, candidate))
      .sort((a, b) => b.score - a.score)[0];
    if (!scored || scored.score < MIN_ITEM_SCORE) continue;

    bestById.set(candidate.id, {
      movie_id: candidate.id,
      slug: candidate.slug,
      label: candidate.name,
      item_type: itemType(candidate),
      sort_order: 0,
      confidence: scored.score,
      reason: scored.reason,
      movie: candidate,
    });
  }

  const items = Array.from(bestById.values()).sort(sortItems).map((item, index) => ({
    ...item,
    sort_order: (index + 1) * 10,
  }));
  if (!items.length) return null;

  const name = buildSuggestionName(seedMovies);
  const slug = slugify(name || items[0].label);
  const confidence = Math.round(items.reduce((sum, item) => sum + item.confidence, 0) / items.length);

  return {
    name,
    slug,
    confidence,
    reason: confidence >= REVIEW_SCORE ? "high confidence metadata match" : "review recommended before saving",
    existingCollection: findExistingCollection(existingCollections, slug, name),
    items,
  };
}

export async function suggestMovieCollections(seedMovieIds: string[]): Promise<CollectionSuggestion[]> {
  await requireAdminUser();

  const ids = unique(seedMovieIds.filter(Boolean)).slice(0, MAX_SEEDS);
  if (!ids.length) return [];

  const [{ data: seedMovies, error: seedError }, { data: collections, error: collectionError }] = await Promise.all([
    supabaseAdmin
      .from("movies")
      .select("id,slug,name,origin_name,normalized_name,normalized_origin_name,year,type,season,episode_number,episode_current,category_slugs,country_slugs,sources,is_blocked")
      .in("id", ids)
      .eq("is_blocked", false),
    supabaseAdmin.from("movie_collections").select("id,slug,name"),
  ]);

  if (seedError) throw seedError;
  if (collectionError) throw collectionError;

  const seeds = (seedMovies || []) as CandidateMovie[];
  if (!seeds.length) return [];

  const candidates = await loadCandidates(seeds);
  const suggestion = buildCollectionSuggestion(seeds, candidates, (collections || []) as CollectionRecord[]);
  return suggestion ? [suggestion] : [];
}
