import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { roomId, targetUserId, action } = await request.json();
  // action: 'approve' | 'reject' | 'kick'

  // 1. Kiểm tra xem người gọi API có phải Host hoặc có quyền manage_users không
  const { data: me } = await supabase
    .from("watch_party_participants")
    .select("role, permissions")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .single();

  if (
    !me ||
    (me.role !== "host" && !(me.permissions as any)?.can_manage_users)
  ) {
    return NextResponse.json(
      { error: "Bạn không có quyền quản lý thành viên" },
      { status: 403 },
    );
  }

  // 2. Thực thi update Database
  const statusToUpdate = action === "approve" ? "approved" : "blocked";

  const { error } = await supabase
    .from("watch_party_participants")
    .update({ status: statusToUpdate })
    .eq("room_id", roomId)
    .eq("user_id", targetUserId);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
