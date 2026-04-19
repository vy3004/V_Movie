import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ParticipantPermissions } from "@/types/watch-party";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { roomId, targetUserId, action } = await request.json();

    // Validate Input
    if (
      !roomId ||
      !targetUserId ||
      !["approve", "reject", "kick"].includes(action)
    ) {
      return NextResponse.json(
        { error: "Dữ liệu đầu vào không hợp lệ" },
        { status: 400 },
      );
    }

    // 1. Kiểm tra quyền của người ĐANG GỌI API (Người bấm nút)
    const { data: caller } = await supabase
      .from("watch_party_participants")
      .select("role, permissions")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .single();

    const callerPermissions = caller?.permissions as ParticipantPermissions;
    const canManageUsers =
      caller?.role === "host" || callerPermissions?.can_manage_users;

    if (!canManageUsers) {
      return NextResponse.json(
        { error: "Bạn không có quyền quản lý thành viên" },
        { status: 403 },
      );
    }

    // 2. Kiểm tra NGƯỜI BỊ THAO TÁC (Chống lật đổ)
    const { data: targetUser } = await supabase
      .from("watch_party_participants")
      .select("role")
      .eq("room_id", roomId)
      .eq("user_id", targetUserId)
      .single();

    if (!targetUser)
      return NextResponse.json(
        { error: "Không tìm thấy người dùng" },
        { status: 404 },
      );

    // Bảo vệ Host tuyệt đối
    if (targetUser.role === "host") {
      return NextResponse.json(
        { error: "Không thể thao tác lên Chủ phòng" },
        { status: 403 },
      );
    }

    // 3. Xử lý Action: APPROVE (Duyệt người đang gõ cửa)
    if (action === "approve") {
      const { data: room } = await supabase
        .from("watch_party_rooms")
        .select("max_participants")
        .eq("id", roomId)
        .single();

      const { count } = await supabase
        .from("watch_party_participants")
        .select("*", { count: "exact", head: true })
        .eq("room_id", roomId)
        .eq("status", "approved");

      if (room && count !== null && count >= room.max_participants) {
        return NextResponse.json(
          { error: "Phòng đã đạt giới hạn người tham gia tối đa" },
          { status: 403 },
        );
      }

      await supabase
        .from("watch_party_participants")
        .update({ status: "approved" })
        .eq("room_id", roomId)
        .eq("user_id", targetUserId);
    }

    // 4. Xử lý Action: REJECT (Từ chối người đang gõ cửa)
    else if (action === "reject") {
      await supabase
        .from("watch_party_participants")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", targetUserId)
        .eq("status", "pending");
    }

    // 5. Xử lý Action: KICK (Đuổi người đang trong phòng)
    else if (action === "kick") {
      const { error, count } = await supabase
        .from("watch_party_participants")
        .delete({ count: "exact" })
        .eq("room_id", roomId)
        .eq("user_id", targetUserId);

      console.log("Số dòng đã xóa thực tế:", count);

      if (count === 0) {
        console.log("⚠️ Không tìm thấy bản ghi nào để xóa với:", {
          roomId,
          targetUserId,
        });
      }

      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PARTICIPANT_ACTION_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
