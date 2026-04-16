import { createSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  const supabase = await createSupabaseServer();
  const { roomId, targetUserId, permissionKey } = await request.json();

  // 1. Lấy permissions hiện tại
  const { data: p } = await supabase
    .from("watch_party_participants")
    .select("permissions")
    .eq("room_id", roomId)
    .eq("user_id", targetUserId)
    .single();

  if (!p)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const newPermissions = {
    ...p.permissions,
    [permissionKey]: !p.permissions[permissionKey],
  };

  // 2. Cập nhật
  const { error } = await supabase
    .from("watch_party_participants")
    .update({ permissions: newPermissions })
    .eq("room_id", roomId)
    .eq("user_id", targetUserId);

  return NextResponse.json({ success: !error });
}
