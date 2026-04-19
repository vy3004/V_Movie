import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ParticipantPermissions } from "@/types/watch-party";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");

    if (!roomId) {
      return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
    }

    const supabase = await createSupabaseServer();

    //  Join bảng profiles để lấy tên người thêm phim
    const { data, error } = await supabase
      .from("watch_party_playlist")
      .select(
        `
        *,
        profiles:added_by(full_name, avatar_url)
      `,
      )
      .eq("room_id", roomId)
      .order("sort_order", { ascending: true });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("[PLAYLIST_GET_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
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
      return NextResponse.json(
        { error: "Missing required data" },
        { status: 400 },
      );
    }

    // 1. Kiểm tra quyền thêm phim
    const { data: participant } = await supabase
      .from("watch_party_participants")
      .select("role, permissions")
      .eq("room_id", body.roomId)
      .eq("user_id", user.id)
      .eq("status", "approved")
      .single();

    if (!participant) {
      return NextResponse.json(
        { error: "Bạn không có trong phòng này" },
        { status: 403 },
      );
    }

    const permissions = participant.permissions as ParticipantPermissions;
    if (participant.role !== "host" && !permissions?.can_control_media) {
      return NextResponse.json(
        { error: "Bạn không có quyền thêm phim vào hàng đợi" },
        { status: 403 },
      );
    }

    // 2. Lấy sort_order an toàn
    const { data: lastItem } = await supabase
      .from("watch_party_playlist")
      .select("sort_order")
      .eq("room_id", body.roomId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = (lastItem?.sort_order ?? -1) + 1;

    // 3. Thêm vào Playlist
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
  } catch (error) {
    console.error("[PLAYLIST_POST_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id)
      return NextResponse.json(
        { error: "Missing Playlist ID" },
        { status: 400 },
      );

    // 1. Tìm Room ID của Playlist Item này
    const { data: playlistItem } = await supabase
      .from("watch_party_playlist")
      .select("room_id")
      .eq("id", id)
      .single();

    if (!playlistItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // 2. Kiểm tra quyền đổi/xoá phim (Type-safe)
    const { data: caller } = await supabase
      .from("watch_party_participants")
      .select("role, permissions")
      .eq("room_id", playlistItem.room_id)
      .eq("user_id", user.id)
      .single();

    const permissions = caller?.permissions as ParticipantPermissions;

    if (
      !caller ||
      (caller.role !== "host" && !permissions?.can_control_media)
    ) {
      return NextResponse.json(
        { error: "Bạn không có quyền xoá phim khỏi Playlist" },
        { status: 403 },
      );
    }

    // 3. Xoá dữ liệu
    const { error } = await supabase
      .from("watch_party_playlist")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PLAYLIST_DELETE_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
