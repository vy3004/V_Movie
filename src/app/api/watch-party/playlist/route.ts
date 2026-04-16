import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get("roomId");
  const supabase = await createSupabaseServer();

  const { data } = await supabase
    .from("watch_party_playlist")
    .select("*")
    .eq("room_id", roomId)
    .order("sort_order", { ascending: true });

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    if (!body.roomId || !body.movieSlug) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    // 1. Lấy sort_order an toàn hơn
    const { data: lastItem } = await supabase
      .from("watch_party_playlist")
      .select("sort_order")
      .eq("room_id", body.roomId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle(); // Dùng maybeSingle để không crash khi rỗng

    const nextOrder = (lastItem?.sort_order ?? -1) + 1;

    // 2. Insert
    const { data, error } = await supabase
      .from("watch_party_playlist")
      .insert({
        room_id: body.roomId,
        movie_slug: body.movieSlug,
        movie_name: body.movieName,
        episode_slug: body.episodeSlug,
        thumb_url: body.thumbUrl,
        sort_order: nextOrder,
        added_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("[PLAYLIST_POST_ERROR]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("watch_party_playlist")
    .delete()
    .eq("id", id);
  return NextResponse.json({ success: !error });
}
