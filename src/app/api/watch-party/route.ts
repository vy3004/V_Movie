import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { WatchPartyService } from "@/services/watch-party.service";
import { getErrorResponse } from "@/lib/errors/watch-party-errors";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");
    const roomCode = searchParams.get("roomCode");

    const result = await WatchPartyService.getRoom(
      roomId || undefined,
      roomCode || undefined,
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("[WP_GET_ERROR]:", error);
    const { message, statusCode } = getErrorResponse(error);
    return NextResponse.json({ error: message }, { status: statusCode });
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

    // Rate limiting: 3 room creations per 60 seconds per user
    const rateLimitResult = await rateLimit(`wp_create:${user.id}`, 3, 60);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Bạn đang tạo phòng quá nhanh, vui lòng chờ một chút" },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "3",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": rateLimitResult.reset.toString(),
          }
        }
      );
    }

    const body = await request.json();
    const {
      title,
      isPrivate,
      maxParticipants,
      movieSlug,
      movieImage,
      episodeSlug,
      settings,
    } = body;

    if (!movieSlug || !movieImage || !episodeSlug) {
      return NextResponse.json(
        { error: "Thiếu dữ liệu bắt buộc" },
        { status: 400 },
      );
    }

    const room = await WatchPartyService.createRoom({
      hostId: user.id,
      title:
        title || `Cùng xem phim với ${user.user_metadata?.full_name || "User"}`,
      isPrivate,
      maxParticipants,
      movieSlug,
      movieImage,
      episodeSlug,
      settings,
    });

    return NextResponse.json({ room });
  } catch (error) {
    console.error("[WP_CREATE_ERROR]:", error);
    const { message, statusCode } = getErrorResponse(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
