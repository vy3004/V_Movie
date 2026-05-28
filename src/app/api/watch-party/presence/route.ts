import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { WatchPartyPresenceService } from "@/services/watch-party-presence.service";
import type { UserPresence } from "@/types";

export const runtime = "edge";

const isPresenceStatus = (status: unknown): status is UserPresence["status"] =>
  status === "online" || status === "away";

const isPresenceAction = (action: unknown): action is "heartbeat" | "leave" =>
  action === "heartbeat" || action === "leave";

async function ensureApprovedParticipant(roomId: string) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized", status: 401 as const };

  const { data: participant, error } = await supabase
    .from("watch_party_participants")
    .select("id")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .eq("status", "approved")
    .maybeSingle();

  if (error || !participant) return { error: "Not in room", status: 403 as const };

  return { user };
}

export async function GET(request: Request) {
  try {
    const roomId = new URL(request.url).searchParams.get("roomId");
    if (!roomId) {
      return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
    }

    const auth = await ensureApprovedParticipant(roomId);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const [activeLeases, staleUserIds] = await Promise.all([
      WatchPartyPresenceService.getActiveLeases(roomId),
      WatchPartyPresenceService.getStaleUserIds(roomId),
    ]);
    return NextResponse.json({ activeLeases, staleUserIds });
  } catch (error) {
    console.error("[WATCH_PARTY_PRESENCE_STALE_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { roomId, sessionId, status, action } = await request.json();

    if (
      typeof roomId !== "string" ||
      typeof sessionId !== "string" ||
      !isPresenceAction(action) ||
      (action === "heartbeat" && !isPresenceStatus(status))
    ) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const auth = await ensureApprovedParticipant(roomId);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (action === "leave") {
      await WatchPartyPresenceService.leave({
        roomId,
        userId: auth.user.id,
        sessionId,
      });
      return NextResponse.json({ success: true });
    }

    await WatchPartyPresenceService.touch({
      roomId,
      userId: auth.user.id,
      sessionId,
      status,
      source: "data-channel",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[WATCH_PARTY_PRESENCE_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
