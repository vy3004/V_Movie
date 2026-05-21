import { supabaseAdmin } from "@/lib/supabase/admin";
import { IndexJobMode, IndexedMovie, IndexedSourceSnapshot, MovieSource, SourceMovieCardInput } from "@/types";
import { fetchSourceMovieCards } from "@/services/admin-movie-indexer/source-clients";
import { buildIndexedSourceSnapshot, buildSourceRef } from "@/services/admin-movie-indexer/normalize";
import { classifyCandidate, mergeSourceIntoMovie } from "@/services/admin-movie-indexer/merge";

const PAGES_PER_JOB = 5;

type SupabaseClientLike = typeof supabaseAdmin;

export type IndexMovieCardPlan =
  | { action: "insert"; movie: IndexedMovie }
  | { action: "update"; movie: IndexedMovie }
  | {
      action: "review";
      review: {
        reason: string;
        confidence_score: number;
        candidate_sources: IndexedSourceSnapshot[];
        target_movie_id: string;
      };
    }
  | { action: "skip"; reason: string; incoming: IndexedSourceSnapshot };

export function buildIndexJobInsert(
  source: MovieSource,
  mode: IndexJobMode,
  pageStart: number,
  createdBy: "cron" | "admin",
) {
  return {
    source,
    mode,
    page_start: pageStart,
    page_end: pageStart + PAGES_PER_JOB - 1,
    status: "queued",
    created_by: createdBy,
  };
}

function mergeStatusFromSnapshot(snapshot: IndexedSourceSnapshot): IndexedMovie["merge_status"] {
  return snapshot.category_slugs?.includes("phim-18") ? "review" : "merged";
}

function movieFromSnapshot(snapshot: IndexedSourceSnapshot): IndexedMovie {
  return {
    id: "",
    slug: snapshot.slug,
    name: snapshot.name,
    origin_name: snapshot.origin_name,
    normalized_name: snapshot.normalized_name,
    normalized_origin_name: snapshot.normalized_origin_name,
    search_text: snapshot.search_text,
    dedupe_key: snapshot.dedupe_key,
    year: snapshot.year,
    type: snapshot.type,
    status: snapshot.status ?? null,
    thumb_url: snapshot.thumb_url ?? null,
    poster_url: snapshot.poster_url ?? null,
    episode_current: snapshot.episode_current,
    episode_number: snapshot.episode_number,
    episode_state: snapshot.episode_state,
    season: snapshot.season,
    quality: snapshot.quality ?? null,
    lang: snapshot.lang ?? null,
    category_slugs: snapshot.category_slugs ?? [],
    country_slugs: snapshot.country_slugs ?? [],
    source_vote_average: snapshot.source_vote_average,
    source_vote_count: snapshot.source_vote_count,
    vote_average: snapshot.vote_average,
    vote_count: snapshot.vote_count,
    popularity_score: snapshot.popularity_score,
    sources: [buildSourceRef(snapshot)],
    primary_source: snapshot.source,
    primary_source_slug: snapshot.slug,
    merge_status: mergeStatusFromSnapshot(snapshot),
    content_hash: snapshot.content_hash,
    last_synced_at: new Date().toISOString(),
  };
}

function isUnchangedSource(candidate: IndexedMovie, incoming: IndexedSourceSnapshot): boolean {
  const existingSource = candidate.sources.find((source) => source.source === incoming.source && source.slug === incoming.slug);
  return Boolean(
    existingSource &&
      existingSource.content_hash === incoming.content_hash &&
      candidate.episode_number >= incoming.episode_number,
  );
}

function snapshotFromMovie(candidate: IndexedMovie): IndexedSourceSnapshot {
  return {
    source: candidate.primary_source || "ophim",
    slug: candidate.primary_source_slug || candidate.slug,
    name: candidate.name,
    origin_name: candidate.origin_name || "",
    episode_current: candidate.episode_current || "",
    year: candidate.year,
    type: candidate.type || "",
    status: candidate.status,
    thumb_url: candidate.thumb_url,
    poster_url: candidate.poster_url,
    quality: candidate.quality,
    lang: candidate.lang,
    category_slugs: candidate.category_slugs,
    country_slugs: candidate.country_slugs,
    normalized_name: candidate.normalized_name,
    normalized_origin_name: candidate.normalized_origin_name || "",
    search_text: candidate.search_text,
    dedupe_key: candidate.dedupe_key,
    episode_number: candidate.episode_number,
    episode_state: candidate.episode_state,
    season: candidate.season,
    source_vote_average: candidate.source_vote_average,
    source_vote_count: candidate.source_vote_count,
    vote_average: candidate.vote_average,
    vote_count: candidate.vote_count,
    popularity_score: candidate.popularity_score,
    content_hash: candidate.content_hash || "",
  };
}

export function buildIndexMovieCardPlan(
  input: SourceMovieCardInput,
  candidates: IndexedMovie[],
): IndexMovieCardPlan {
  const incoming = buildIndexedSourceSnapshot(input);
  if (!incoming.slug || !incoming.name) return { action: "skip", reason: "missing_identity", incoming };

  if (candidates.length === 0) return { action: "insert", movie: movieFromSnapshot(incoming) };

  for (const candidate of candidates) {
    const existingSource = snapshotFromMovie(candidate);

    if (candidate.slug === incoming.slug || candidate.sources.some((source) => source.source === incoming.source && source.slug === incoming.slug)) {
      if (isUnchangedSource(candidate, incoming)) return { action: "skip", reason: "unchanged", incoming };
      return { action: "update", movie: mergeSourceIntoMovie(candidate, incoming) };
    }

    const decision = classifyCandidate(existingSource, incoming);
    if (decision.decision === "auto_merge") {
      return { action: "update", movie: mergeSourceIntoMovie(candidate, incoming) };
    }

    if (decision.decision === "needs_review") {
      return {
        action: "review",
        review: {
          reason: decision.reason,
          confidence_score: decision.confidence,
          candidate_sources: [existingSource, incoming],
          target_movie_id: candidate.id,
        },
      };
    }
  }

  return { action: "skip", reason: "keep_separate", incoming };
}

async function findIndexCandidates(supabase: SupabaseClientLike, snapshot: IndexedSourceSnapshot): Promise<IndexedMovie[]> {
  const { data: byDedupeKey, error: dedupeError } = await supabase
    .from("movies")
    .select("*")
    .eq("dedupe_key", snapshot.dedupe_key)
    .limit(10);
  if (dedupeError) throw dedupeError;

  const { data: bySlug, error: slugError } = await supabase
    .from("movies")
    .select("*")
    .eq("slug", snapshot.slug)
    .limit(10);
  if (slugError) throw slugError;

  const seen = new Set<string>();
  const results: IndexedMovie[] = [];
  for (const movie of [...(byDedupeKey || []), ...(bySlug || [])]) {
    if (seen.has(movie.id)) continue;
    seen.add(movie.id);
    results.push(movie as IndexedMovie);
  }

  return results.slice(0, 10);
}

async function applyIndexPlan(supabase: SupabaseClientLike, plan: IndexMovieCardPlan) {
  if (plan.action === "insert") {
    const movie = { ...plan.movie, id: undefined };
    const { data, error } = await supabase.from("movies").insert(movie).select("*").single();
    if (error) throw error;
    return { action: "insert" as const, movie: data as IndexedMovie };
  }

  if (plan.action === "update") {
    const { data, error } = await supabase
      .from("movies")
      .update(plan.movie)
      .eq("id", plan.movie.id)
      .select("*")
      .single();
    if (error) throw error;
    return { action: "update" as const, movie: data as IndexedMovie };
  }

  if (plan.action === "review") {
    const { error } = await supabase.from("review_queue").insert({
      status: "pending",
      confidence_score: plan.review.confidence_score,
      reason: plan.review.reason,
      candidate_sources: plan.review.candidate_sources,
      target_movie_id: plan.review.target_movie_id,
    });
    if (error) throw error;
  }

  return plan;
}

export const MovieIndexerService = {
  async enqueueJob(
    source: MovieSource,
    mode: IndexJobMode,
    pageStart: number,
    createdBy: "cron" | "admin" = "admin",
  ) {
    const { data, error } = await supabaseAdmin
      .from("movie_index_jobs")
      .insert(buildIndexJobInsert(source, mode, pageStart, createdBy))
      .select("*")
      .single();

    if (error) throw error;
    return data;
  },

  async setSourcePaused(source: MovieSource, paused: boolean) {
    const { error } = await supabaseAdmin
      .from("movie_index_state")
      .update({ paused, updated_at: new Date().toISOString() })
      .eq("source", source);

    if (error) throw error;
  },

  async indexMovieCard(input: SourceMovieCardInput) {
    const snapshot = buildIndexedSourceSnapshot(input);
    const candidates = await findIndexCandidates(supabaseAdmin, snapshot);
    return applyIndexPlan(supabaseAdmin, buildIndexMovieCardPlan(input, candidates));
  },

  async indexSourcePage(source: MovieSource, page: number) {
    const cards = await fetchSourceMovieCards(source, page);
    const results = [];

    for (const card of cards) {
      results.push(await this.indexMovieCard(card));
    }

    return results;
  },
};

