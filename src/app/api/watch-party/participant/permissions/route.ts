import { createSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { ParticipantPermissions } from "@/types/watch-party";

export async function PATCH(request: Request) {
  try {
    const supabase = await createSupabaseServer();

    // 1. Kiểm tra Auth
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomId, targetUserId, permissionKey } = await request.json();

    if (!roomId || !targetUserId || !permissionKey) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Validate key an toàn
    const validPermissions = ["can_control_media", "can_manage_users"];
    if (!validPermissions.includes(permissionKey)) {
      return NextResponse.json(
        { error: "Quyền không hợp lệ" },
        { status: 400 },
      );
    }

    // 2. Kiểm tra quyền của người ĐANG GỌI API (Caller)
    // FIX BẢO MẬT: CHỈ CÓ HOST ĐÍCH THỰC MỚI ĐƯỢC QUYỀN GỌI API NÀY. Mod không được phép.
    const { data: caller } = await supabase
      .from("watch_party_participants")
      .select("role")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .single();

    if (!caller || caller.role !== "host") {
      return NextResponse.json(
        { error: "Chỉ Chủ phòng mới có quyền phân quyền thành viên" },
        { status: 403 },
      );
    }

    // 3. Lấy thông tin người bị đổi quyền (TargetUser)
    const { data: targetUser } = await supabase
      .from("watch_party_participants")
      .select("role, permissions")
      .eq("room_id", roomId)
      .eq("user_id", targetUserId)
      .single();

    if (!targetUser) {
      return NextResponse.json(
        { error: "User not found in this room" },
        { status: 404 },
      );
    }

    // FIX BẢO MẬT: Chặn không ai được phép sửa permissions của Host
    if (targetUser.role === "host") {
      return NextResponse.json(
        { error: "Không thể thay đổi quyền hạn của Chủ phòng" },
        { status: 403 },
      );
    }

    // 4. Toggle quyền mới
    const currentPermissions =
      (targetUser.permissions as ParticipantPermissions) || {
        can_control_media: false,
        can_manage_users: false,
      };

    const newPermissions = {
      ...currentPermissions,
      [permissionKey]:
        !currentPermissions[permissionKey as keyof ParticipantPermissions],
    };

    // 5. Cập nhật Database
    const { error } = await supabase
      .from("watch_party_participants")
      .update({ permissions: newPermissions })
      .eq("room_id", roomId)
      .eq("user_id", targetUserId);

    if (error) throw error;

    return NextResponse.json({ success: true, permissions: newPermissions });
  } catch (error) {
    console.error("[WP_PERMISSIONS_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
