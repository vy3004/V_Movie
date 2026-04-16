import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { roomId, ...updates } = await request.json();

  // Chỉ Host mới được chỉnh settings tổng của phòng
  const { data: room } = await supabase
    .from("watch_party_rooms")
    .select("host_id")
    .eq("id", roomId)
    .single();
  if (room?.host_id !== user?.id)
    return NextResponse.json({ error: "No permission" }, { status: 403 });

  const { error } = await supabase
    .from("watch_party_rooms")
    .update(updates)
    .eq("id", roomId);
  return NextResponse.json({ success: !error });
}
