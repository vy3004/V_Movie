import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { WatchPartyContentService } from "@/services/watch-party-content.service";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");

    if (!roomId) {
      return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
    }

    const playlist = await WatchPartyContentService.getPlaylist(roomId, user.id);

    return NextResponse.json(playlist);
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

    const data = await WatchPartyContentService.addToPlaylist({
      roomId: body.roomId,
      userId: user.id,
      movieSlug: body.movieSlug,
      movieName: body.movieName,
      episodeSlug: body.episodeSlug,
      thumbUrl: body.thumbUrl,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[PLAYLIST_POST_ERROR]:", error);
    const message =
      error instanceof Error ? error.message : "Internal Server Error";

    let status = 500;
    if (message.includes("không có quyền")) status = 403;
    else if (message.includes("không có trong phòng")) status = 403;
    else if (message.includes("đã có trong danh sách")) status = 409;

    return NextResponse.json({ error: message }, { status });
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

    await WatchPartyContentService.removeFromPlaylist(id, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PLAYLIST_DELETE_ERROR]:", error);
    const message =
      error instanceof Error ? error.message : "Internal Server Error";

    let status = 500;
    if (message.includes("không tồn tại")) status = 404;
    else if (message.includes("không có quyền")) status = 403;

    return NextResponse.json({ error: message }, { status });
  }
}
