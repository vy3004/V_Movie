import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "edge";

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const {
    data: { user: host },
  } = await supabase.auth.getUser();
  const { roomId, targetUserId, action } = await request.json(); // action: 'approve' | 'kick' | 'mute'

  // Kiểm tra quyền (Host hoặc Moderator)
  const { data: actor } = await supabase
    .from("watch_party_participants")
    .select("role")
    .eq("room_id", roomId)
    .eq("user_id", host?.id)
    .single();

  if (!actor || (actor.role !== "host" && actor.role !== "moderator")) {
    return NextResponse.json({ error: "No permission" }, { status: 403 });
  }

  let updateData = {};
  if (action === "approve") updateData = { status: "approved" };
  if (action === "kick") updateData = { status: "blocked" };
  if (action === "mute") updateData = { is_muted: true };

  const { error } = await supabase
    .from("watch_party_participants")
    .update(updateData)
    .eq("room_id", roomId)
    .eq("user_id", targetUserId);

  return NextResponse.json({ success: !error });
}
