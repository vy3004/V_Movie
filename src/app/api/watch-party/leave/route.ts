import { createSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { roomId } = await request.json();

    if (!roomId)
      return NextResponse.json({ error: "Missing Room ID" }, { status: 400 });

    const { error: deleteError } = await supabase
      .from("watch_party_participants")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", user.id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[LEAVE_ROOM_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
