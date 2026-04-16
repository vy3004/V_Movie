import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { NotificationService } from "@/services/notification.service";

export const runtime = "edge";

export async function GET() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json([]);

  const data = await NotificationService.getList(user.id);
  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await req.json();

    await NotificationService.markAsRead(user.id, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API_NOTIFICATIONS_PATCH]:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
