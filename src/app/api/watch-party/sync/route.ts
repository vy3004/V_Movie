import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { WatchPartyService } from "@/services/watch-party.service";
import { getErrorResponse } from "@/lib/errors/watch-party-errors";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
