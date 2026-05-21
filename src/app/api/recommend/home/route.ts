import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { createSupabaseServer } from "@/lib/supabase/server";
import { MovieRecommendation } from "@/types/movie";

export async function GET() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ movies: [], isGuest: true });

  let movies: MovieRecommendation[] = [];

  try {
    const cached = await redis?.get<MovieRecommendation[] | string>(`recommendation:user:${user.id}`);
    if (typeof cached === "string") {
      try {
        movies = JSON.parse(cached) as MovieRecommendation[];
      } catch {
        movies = [];
      }
    }
    if (Array.isArray(cached)) movies = cached;

    if (movies.length === 0) {
      const { data } = await supabase
        .from("user_recommendations")
        .select("recommendations")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data && Array.isArray(data.recommendations)) movies = data.recommendations;
    }
  } catch (error) {
    console.error("[recommend/home] Failed to load user recommendations", error);
  }

  return NextResponse.json({ movies, isGuest: false });
}
