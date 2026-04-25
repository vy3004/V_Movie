import { createSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { ParticipantPermissions } from "@/types/watch-party";

export const runtime = "edge";

type ParticipantUpdate = {
  is_muted?: boolean;
  is_voice_muted?: boolean;
  permissions?: ParticipantPermissions;
};

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

    const validPermissions = [
      "can_control_media",
      "can_manage_users",
      "is_muted",
      "is_voice_muted",
    ];
    if (!validPermissions.includes(permissionKey)) {
      return NextResponse.json(
        { error: "Quyền không hợp lệ" },
        { status: 400 },
      );
    }

    // 2. Kiểm tra quyền của người ĐANG GỌI API (Caller)
    const { data: caller } = await supabase
      .from("watch_party_participants")
      .select("role, permissions")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .single();

    // LOGIC QUYỀN LỰC:
    // - Đổi quyền Control/Manage: CHỈ HOST
    // - Mute chat: HOST hoặc MOD
    const isHost = caller?.role === "host";
    const isMod = caller?.permissions?.can_manage_users === true;

    if (!isHost && !isMod) {
      // Nếu không phải Host hoặc Mod, thì không được sửa bất kỳ quyền gì
      return NextResponse.json(
        { error: "Bạn không có quyền" },
        { status: 403 },
      );
    }

    if (
      !isHost &&
      (permissionKey === "can_control_media" ||
        permissionKey === "can_manage_users")
    ) {
      // Mod thì được cấm chat/cấm mic, nhưng KHÔNG ĐƯỢC phân quyền Mod/Media cho người khác
      return NextResponse.json(
        { error: "Chỉ Chủ phòng mới có quyền phân quyền hệ thống" },
        { status: 403 },
      );
    }

    // 3. Lấy thông tin người bị đổi quyền (TargetUser)
    // Lấy thêm is_muted
    const { data: targetUser } = await supabase
      .from("watch_party_participants")
      .select("role, permissions, is_muted, is_voice_muted")
      .eq("room_id", roomId)
      .eq("user_id", targetUserId)
      .single();

    if (!targetUser) {
      return NextResponse.json(
        { error: "User not found in this room" },
        { status: 404 },
      );
    }

    if (targetUser.role === "host") {
      return NextResponse.json(
        { error: "Không thể thay đổi quyền hạn của Chủ phòng" },
        { status: 403 },
      );
    }

    // 4. Chuẩn bị dữ liệu cập nhật (Phân loại Cột vs JSONB)
    let updateData: ParticipantUpdate = {};

    if (permissionKey === "is_muted") {
      updateData = { is_muted: !targetUser.is_muted };
    } else if (permissionKey === "is_voice_muted") {
      updateData = { is_voice_muted: !targetUser.is_voice_muted };
    } else {
      const currentPermissions =
        (targetUser.permissions as ParticipantPermissions) || {
          can_control_media: false,
          can_manage_users: false,
        };

      updateData = {
        permissions: {
          ...currentPermissions,
          [permissionKey]:
            !currentPermissions[permissionKey as keyof ParticipantPermissions],
        },
      };
    }

    // 5. Cập nhật Database
    const { error } = await supabase
      .from("watch_party_participants")
      .update(updateData)
      .eq("room_id", roomId)
      .eq("user_id", targetUserId);

    if (error) throw error;

    return NextResponse.json({ success: true, updatedKey: permissionKey });
  } catch (error) {
    console.error("[WP_PERMISSIONS_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
