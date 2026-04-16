import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { SubscriptionService } from "@/services/subscription.service";

export async function POST(req: Request) {
  const { movieSlug } = await req.json();
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !movieSlug)
    return NextResponse.json({ error: "Invalid" }, { status: 400 });

  try {
    await SubscriptionService.clearBadge(user.id, movieSlug);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
