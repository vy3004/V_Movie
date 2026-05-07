import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomId } = await req.json();

    if (!roomId) {
      return NextResponse.json(
        { error: "Missing roomId" },
        { status: 400 }
      );
    }

    // Kiểm tra quyền: chỉ host hoặc mod mới được mute all
    const { data: myParticipant } = await supabase
      .from("watch_party_participants")
      .select("role, permissions")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .single();

    if (!myParticipant) {
      return NextResponse.json(
        { error: "Not a participant" },
        { status: 403 }
      );
    }

    const isHost = myParticipant.role === "host";
    const isMod = myParticipant.permissions?.can_manage_users === true;

    if (!isHost && !isMod) {
      return NextResponse.json(
        { error: "No permission to mute all" },
        { status: 403 }
      );
    }

    // Mute tất cả user trừ host và mod
    const { error } = await supabase
      .from("watch_party_participants")
      .update({ is_muted: true })
      .eq("room_id", roomId)
      .neq("role", "host")
      .neq("permissions->can_manage_users", true);

    if (error) {
      console.error("Error muting all participants:", error);
      return NextResponse.json(
        { error: "Failed to mute all" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mute all error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
