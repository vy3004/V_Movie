import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { WatchPartyService } from "@/services/watch-party.service";
import { getErrorResponse } from "@/lib/errors/watch-party-errors";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Rate limiting: 10 control actions per 5 seconds per user
    const rateLimitResult = await rateLimit(`wp_control:${user.id}`, 10, 5);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Bạn đang thao tác quá nhanh, vui lòng chờ một chút" },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "10",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": rateLimitResult.reset.toString(),
          }
        }
      );
    }

    const { roomId, status, time, episodeSlug } = await request.json();
    if (!roomId)
      return NextResponse.json({ error: "Missing roomId" }, { status: 400 });

    const result = await WatchPartyService.syncVideoState({
      roomId,
      userId: user.id,
      status,
      time,
      episodeSlug,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[WP_SYNC_ERROR]:", error);
    const { message, statusCode } = getErrorResponse(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
