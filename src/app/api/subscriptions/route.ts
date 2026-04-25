import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { SubscriptionService } from "@/services/subscription.service";

export const runtime = "edge";

export async function GET(req: Request) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);

  // Hỗ trợ Infinite Scroll & Filter
  const pageParam = parseInt(searchParams.get("page") || "1", 10);
  const limitParam = parseInt(searchParams.get("limit") || "15", 10);
  const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
  const limit =
    Number.isNaN(limitParam) || limitParam < 1 ? 15 : Math.min(limitParam, 100);
  const filterParam = searchParams.get("filter") || "all";
  const filter: "all" | "new" = filterParam === "new" ? "new" : "all";
  const keyword = searchParams.get("keyword") || "";

  const result = await SubscriptionService.getListPaginated(user.id, {
    page,
    limit,
    filter,
    keyword,
  });

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const body = await req.json();
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Add sẽ tự động cập nhật Cache và Stats Counter
  const item = await SubscriptionService.add(user.id, body);
  return NextResponse.json({ success: true, item });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const movieSlug = searchParams.get("movieSlug");
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!movieSlug)
    return NextResponse.json({ error: "Missing movieSlug" }, { status: 400 });

  // Xóa 1 phim và tự động trừ điểm stats
  await SubscriptionService.remove(user.id, movieSlug);
  return NextResponse.json({ success: true });
}
