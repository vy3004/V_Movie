import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";

  const supabase = await createSupabaseServer();

  let query = supabase
    .from("watch_party_rooms")
    .select(
      `
      id, room_code, title, current_movie_slug, current_episode_slug, is_private, created_at,
      movie_image, max_participants,
      host:profiles!host_id(full_name, avatar_url),
      participants:watch_party_participants(count)
    `,
    )
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(
      `room_code.ilike.%${search}%,title.ilike.%${search}%,current_movie_slug.ilike.%${search}%`,
    );
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ rooms: data });
}
