import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json([]);

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json(data || []);
}

export async function PATCH(req: Request) {
  const { id } = await req.json();
  const supabase = await createSupabaseServer();
  // Đánh dấu 1 hoặc tất cả là đã đọc
  const query = supabase.from("notifications").update({ is_read: true });
  if (id) query.eq("id", id);
  else {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    query.eq("user_id", user?.id);
  }
  await query;
  return NextResponse.json({ success: true });
}
