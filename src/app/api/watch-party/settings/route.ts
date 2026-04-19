import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { WatchPartyRoom } from "@/types";

export async function PATCH(request: Request) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { roomId, title, is_private, max_participants, is_active, settings } =
      body;

    if (!roomId)
      return NextResponse.json({ error: "Missing roomId" }, { status: 400 });

    // 1. Kiểm tra quyền (Chỉ Host mới được chỉnh setting phòng)
    const { data: room, error: roomErr } = await supabase
      .from("watch_party_rooms")
      .select("host_id")
      .eq("id", roomId)
      .single();

    if (roomErr || !room) {
      return NextResponse.json(
        { error: "Phòng không tồn tại" },
        { status: 404 },
      );
    }

    if (room.host_id !== user.id) {
      return NextResponse.json(
        { error: "Chỉ Chủ phòng mới được thay đổi cài đặt" },
        { status: 403 },
      );
    }

    // 2. LỌC DỮ LIỆU (Chống Mass Assignment Vulnerability)
    const safeUpdates: Partial<WatchPartyRoom> = {};

    // Chỉ gán giá trị nếu client có gửi lên (khác undefined)
    if (title !== undefined) safeUpdates.title = title;
    if (is_private !== undefined) safeUpdates.is_private = is_private;
    if (max_participants !== undefined)
      safeUpdates.max_participants = max_participants;
    if (is_active !== undefined) safeUpdates.is_active = is_active;
    if (settings !== undefined) safeUpdates.settings = settings;

    // Nếu không có gì hợp lệ để update thì return luôn cho nhẹ Server
    if (Object.keys(safeUpdates).length === 0) {
      return NextResponse.json({
        success: true,
        message: "No valid fields to update",
      });
    }

    // 3. Tiến hành cập nhật
    const { error: updateErr } = await supabase
      .from("watch_party_rooms")
      .update(safeUpdates)
      .eq("id", roomId);

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[WP_SETTINGS_UPDATE_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
