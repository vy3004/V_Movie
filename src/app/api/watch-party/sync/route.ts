import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { WatchPartyService } from "@/services/watch-party.service";
import { getErrorResponse } from "@/lib/errors/watch-party-errors";
import { syncVideoRouteSchema } from "@/lib/validations/watch-party.validation";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const parsed = syncVideoRouteSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid request" },
        { status: 400 },
      );
    }

    const { roomId, status, time, episodeSlug, requestId } = parsed.data;
    const result = await WatchPartyService.syncVideoState({
      roomId,
      userId: user.id,
      status,
      time,
      episodeSlug,
    });

    return NextResponse.json({ ...result, requestId });
  } catch (error) {
    console.error("[WP_SYNC_ERROR]:", error);
    const { message, statusCode } = getErrorResponse(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
