import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { roomId } = await request.json();
  if (!roomId) {
    return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
  }

  const { data: room, error: roomErr } = await supabase
    .from("watch_party_rooms")
    .select("is_private")
    .eq("id", roomId)
    .single();

  if (roomErr || !room) {
    return NextResponse.json({ error: "Phòng không tồn tại" }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from("watch_party_participants")
    .select("status")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .single();

  if (existing) {
    return NextResponse.json({ success: true, status: existing.status });
  }

  const status = room.is_private ? "pending" : "approved";
  const { error } = await supabase
    .from("watch_party_participants")
    .insert({ room_id: roomId, user_id: user.id, status: status });

  if (error) {
    // FIX RACE CONDITION: Nếu lỗi là do trùng lặp (đã insert kịp 1 mili-giây trước đó) thì coi như thành công
    if (error.code === "23505") {
      return NextResponse.json({ success: true, status });
    }
    console.error("[JOIN_ERROR]:", error);
    return NextResponse.json(
      { error: "Lỗi khi tham gia phòng" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, status });
}
