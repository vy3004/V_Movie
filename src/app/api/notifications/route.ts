import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { NotificationService } from "@/services/notification.service";

export const runtime = "edge";

export async function GET(req: Request) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ items: [], nextCursor: null, total: 0 });

  const { searchParams } = new URL(req.url);
  const parsedPage = parseInt(searchParams.get("page") || "1", 10);
  const parsedLimit = parseInt(searchParams.get("limit") || "15", 10);
  const page = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
  const limit = Math.min(
    Number.isNaN(parsedLimit) || parsedLimit < 1 ? 15 : parsedLimit,
    50,
  );

  const data = await NotificationService.getList(user.id, page, limit);
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

export async function DELETE(req: Request) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const onlyRead = searchParams.get("onlyRead") === "true";

    await NotificationService.clear(user.id, onlyRead);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API_NOTIFICATIONS_DELETE]:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
