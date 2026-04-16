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
  const limit = parseInt(searchParams.get("limit") || "12");

  const data = await SubscriptionService.getList(user.id, limit);
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = await req.json();
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  await SubscriptionService.remove(user.id, movieSlug);
  return NextResponse.json({ success: true });
}
