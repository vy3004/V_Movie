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

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting: 5 join attempts per 30 seconds per user
    const rateLimitResult = await rateLimit(`wp_join:${user.id}`, 5, 30);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Bạn đang thử tham gia phòng quá nhanh, vui lòng chờ một chút" },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "5",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": rateLimitResult.reset.toString(),
          }
        }
      );
    }

    const { roomId } = await request.json();
    if (!roomId) {
      return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
    }

    const result = await WatchPartyService.joinRoom(roomId, user.id);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[JOIN_ERROR]:", error);
    const { message, statusCode } = getErrorResponse(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
