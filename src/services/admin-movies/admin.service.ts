import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/services/admin-movie-indexer/admin.service";
import { normalizeCollectionItems, type CollectionItemInput } from "@/services/admin-movies/collections";
import { buildMergedMoviePatch } from "@/services/admin-movies/merge";
import { buildAdminMovieQueryParams } from "@/services/admin-movies/query";
import type { IndexedMovie } from "@/types/admin-movie-indexer";

const EDITABLE_MOVIE_FIELDS = new Set([
  "name",
  "origin_name",
  "slug",
  "year",
  "type",
  "season",
  "episode_current",
  "episode_number",
  "thumb_url",
  "poster_url",
  "primary_source",
  "primary_source_slug",
  "category_slugs",
  "country_slugs",
  "merge_status",
  "is_blocked",
]);

type RawParams = Record<string, string | string[] | undefined>;

type MergeAdminMoviesInput = {
  canonicalMovieId: string;
  duplicateMovieIds: string[];
  fieldValues: Record<string, unknown>;
};

function allowedMoviePatch(patch: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(patch).filter(([key]) => EDITABLE_MOVIE_FIELDS.has(key)),
  );
}

function escapeIlikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&").replace(/,/g, "\\,");
}

export async function listAdminMovies(rawParams: RawParams) {
  await requireAdminUser();

  const params = buildAdminMovieQueryParams(rawParams);
  let query = supabaseAdmin.from("movies").select("*", { count: "exact" }).order("updated_at", { ascending: false });

  if (params.keyword) {
    const escapedKeyword = escapeIlikePattern(params.keyword);
    query = query.or(
      `name.ilike.%${escapedKeyword}%,origin_name.ilike.%${escapedKeyword}%,slug.ilike.%${escapedKeyword}%,search_text.ilike.%${escapedKeyword}%`,
    );
  }

  if (params.source !== "all") query = query.contains("sources", [{ source: params.source }]);
  if (params.mergeStatus !== "all") query = query.eq("merge_status", params.mergeStatus);
  if (params.blocked === "active") query = query.eq("is_blocked", false);
  if (params.blocked === "blocked") query = query.eq("is_blocked", true);
  if (params.category) query = query.contains("category_slugs", [params.category]);
  if (params.type) query = query.eq("type", params.type);
  if (params.year) query = query.eq("year", params.year);
  if (params.duplicateOnly) query = query.not("dedupe_key", "is", null).not("dedupe_key", "eq", "");

  const { data, error, count } = await query.range(params.offset, params.offset + params.limit - 1);
  if (error) throw error;

  return {
    items: data || [],
    pagination: {
      page: params.page,
      limit: params.limit,
      total: count || 0,
      totalPages: Math.max(1, Math.ceil((count || 0) / params.limit)),
    },
  };
}

export async function updateAdminMovie(id: string, patch: Record<string, unknown>) {
  await requireAdminUser();

  const nextPatch = {
    ...allowedMoviePatch(patch),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin.from("movies").update(nextPatch).eq("id", id).select("*").single();
  if (error) throw error;

  return data;
}

export async function mergeAdminMovies(input: MergeAdminMoviesInput) {
  await requireAdminUser();

  const movieIds = [input.canonicalMovieId, ...input.duplicateMovieIds];
  const { data: movies, error: readError } = await supabaseAdmin.from("movies").select("*").in("id", movieIds);
  if (readError) throw readError;

  const sourceGroups = ((movies || []) as IndexedMovie[]).map((movie) => movie.sources || []);
  const patch = buildMergedMoviePatch({
    fieldValues: allowedMoviePatch(input.fieldValues),
    sourceGroups,
  });

  const { data: canonical, error: updateError } = await supabaseAdmin
    .from("movies")
    .update(patch)
    .eq("id", input.canonicalMovieId)
    .select("*")
    .single();
  if (updateError) throw updateError;

  if (input.duplicateMovieIds.length) {
    const { error: blockError } = await supabaseAdmin
      .from("movies")
      .update({ is_blocked: true, updated_at: new Date().toISOString() })
      .in("id", input.duplicateMovieIds);
    if (blockError) throw blockError;
  }

  return canonical;
}

export async function listMovieCollections(keyword = "") {
  await requireAdminUser();

  let query = supabaseAdmin
    .from("movie_collections")
    .select("*, movie_collection_items(*)")
    .order("updated_at", { ascending: false });

  if (keyword.trim()) {
    const escapedKeyword = escapeIlikePattern(keyword.trim());
    query = query.or(`name.ilike.%${escapedKeyword}%,slug.ilike.%${escapedKeyword}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return data || [];
}

export async function createMovieCollection(input: { slug: string; name: string }) {
  await requireAdminUser();

  const { data, error } = await supabaseAdmin
    .from("movie_collections")
    .insert({ slug: input.slug.trim(), name: input.name.trim() })
    .select("*")
    .single();
  if (error) throw error;

  return data;
}

export async function updateMovieCollection(id: string, patch: { slug?: string; name?: string }) {
  await requireAdminUser();

  const nextPatch = {
    ...(patch.slug !== undefined ? { slug: patch.slug.trim() } : {}),
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin.from("movie_collections").update(nextPatch).eq("id", id).select("*").single();
  if (error) throw error;

  return data;
}

export async function addMovieCollectionItems(collectionId: string, items: CollectionItemInput[]) {
  await requireAdminUser();

  const rows = normalizeCollectionItems(items).map((item) => ({ ...item, collection_id: collectionId }));
  const { data, error } = await supabaseAdmin
    .from("movie_collection_items")
    .upsert(rows, { onConflict: "collection_id,movie_id" })
    .select("*");
  if (error) throw error;

  return data || [];
}

export async function updateMovieCollectionItem(itemId: string, patch: Partial<CollectionItemInput>) {
  await requireAdminUser();

  const { data, error } = await supabaseAdmin
    .from("movie_collection_items")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", itemId)
    .select("*")
    .single();
  if (error) throw error;

  return data;
}

export async function deleteMovieCollectionItem(itemId: string) {
  await requireAdminUser();

  const { error } = await supabaseAdmin.from("movie_collection_items").delete().eq("id", itemId);
  if (error) throw error;

  return { ok: true };
}

