import "server-only";

import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import { buildMovieSearchParams } from "@/services/admin-movie-indexer/search";

function escapeIlikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&").replace(/,/g, "\\,");
}

export async function requireAdminUser() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const appRole = user.app_metadata?.role || user.user_metadata?.role;
  if (profile?.role !== "admin" && appRole !== "admin") redirect("/");

  return user;
}

export async function getSyncDashboard() {
  await requireAdminUser();

  const [state, jobs] = await Promise.all([
    supabaseAdmin.from("movie_index_state").select("*").order("source"),
    supabaseAdmin
      .from("movie_index_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (state.error) throw state.error;
  if (jobs.error) throw jobs.error;

  return { states: state.data || [], jobs: jobs.data || [] };
}

export async function searchIndexedMovies(keyword = "", limit = 24) {
  await requireAdminUser();

  const params = buildMovieSearchParams(keyword, limit);
  let query = supabaseAdmin
    .from("movies")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(params.limit);

  if (params.keyword) {
    const escapedKeyword = escapeIlikePattern(params.keyword);
    query = query.or(
      `normalized_name.ilike.%${escapedKeyword}%,normalized_origin_name.ilike.%${escapedKeyword}%,search_text.ilike.%${escapedKeyword}%`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  return data || [];
}

export async function getReviewQueue() {
  await requireAdminUser();

  const { data, error } = await supabaseAdmin
    .from("review_queue")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  return data || [];
}

export async function getReviewById(id: string) {
  await requireAdminUser();

  const { data, error } = await supabaseAdmin.from("review_queue").select("*").eq("id", id).single();
  if (error) throw error;

  return data;
}

export async function getMergeHistory() {
  await requireAdminUser();

  const { data, error } = await supabaseAdmin
    .from("merge_history")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  return data || [];
}
