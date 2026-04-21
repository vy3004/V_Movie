import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

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
      return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
    }

    // 1. Lấy thông tin phòng để kiểm tra trạng thái
    const { data: room, error: roomErr } = await supabase
      .from("watch_party_rooms")
      .select("is_private, max_participants, is_active")
      .eq("id", roomId)
      .single();

    if (roomErr || !room) {
      return NextResponse.json(
        { error: "Phòng không tồn tại" },
        { status: 404 },
      );
    }

    if (!room.is_active) {
      return NextResponse.json(
        { error: "Phòng này đã kết thúc" },
        { status: 403 },
      );
    }

    // 2. Kiểm tra xem User đã từng vào phòng chưa
    const { data: existing } = await supabase
      .from("watch_party_participants")
      .select("status")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .single();

    if (existing) {
      // FIX LỖI UX: Nếu user đã bị đuổi, phải trả về 403 để UI hiện Toast báo lỗi
      if (existing.status === "blocked") {
        return NextResponse.json(
          { error: "Bạn đã bị chặn khỏi phòng này" },
          { status: 403 },
        );
      }
      return NextResponse.json({ success: true, status: existing.status });
    }

    // 3. FIX LỖI "CỬA SAU": Kiểm tra số lượng người trong phòng (chỉ tính approved)
    const { count } = await supabase
      .from("watch_party_participants")
      .select("*", { count: "exact", head: true })
      .eq("room_id", roomId)
      .eq("status", "approved");

    // Nếu phòng Public và đã đầy -> Chặn ngay lập tức
    if (!room.is_private && count !== null && count >= room.max_participants) {
      return NextResponse.json(
        { error: "Phòng đã đầy, không thể tham gia" },
        { status: 403 },
      );
    }

    // 4. Quyết định trạng thái và Insert
    const status = room.is_private ? "pending" : "approved";
    const { error } = await supabase
      .from("watch_party_participants")
      .insert({ room_id: roomId, user_id: user.id, status });

    if (error) {
      // Race condition fallback
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
  } catch (error) {
    console.error("[JOIN_CATCH_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
