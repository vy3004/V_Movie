import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { escapeSearchPattern } from "@/lib/utils";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";

    const page = Math.max(
      0,
      parseInt(searchParams.get("page") || "0", 10) || 0,
    );
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "12", 10) || 12),
    );
    const from = page * limit;
    const to = from + limit - 1;
    const supabase = await createSupabaseServer();

    let query = supabase
      .from("watch_party_rooms")
      .select(
        `
        id, room_code, title, current_movie_slug, current_episode_slug, 
        is_private, created_at, movie_image, max_participants, participant_count,
        host:profiles!host_id(full_name, avatar_url)
      `,
      )
      .eq("is_active", true)
      .gt("participant_count", 0);

    if (search) {
      const escapedSearch = escapeSearchPattern(search);
      const searchPattern = `%${escapedSearch}%`;
      query = query.or(
        `room_code.ilike.${searchPattern},` +
          `and(is_private.eq.false,title.ilike.${searchPattern}),` +
          `and(is_private.eq.false,current_movie_slug.ilike.${searchPattern})`,
      );
    } else {
      query = query.eq("is_private", false);
    }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      return NextResponse.json({ error: "Lỗi tải phòng" }, { status: 500 });
    }

    const rooms = data || [];
    return NextResponse.json({
      rooms,
      nextPage: rooms.length === limit ? page + 1 : null,
    });
  } catch (error) {
    console.error("[WP_LIST_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
