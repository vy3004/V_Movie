import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { WatchPartyService } from "@/services/watch-party.service";

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

    const { roomId } = await request.json();

    if (!roomId) {
      return NextResponse.json({ error: "Missing Room ID" }, { status: 400 });
    }

    await WatchPartyService.closeRoom(roomId, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CLOSE_ROOM_ERROR]:", error);
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    const status = message.includes("quyền") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
