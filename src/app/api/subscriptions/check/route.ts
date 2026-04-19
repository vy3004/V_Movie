import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { SubscriptionService } from "@/services/subscription.service";

export const runtime = "edge";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const movieSlug = searchParams.get("movieSlug");
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !movieSlug) return NextResponse.json({ isFollowed: false });

    const isFollowed = await SubscriptionService.checkStatus(
      user.id,
      movieSlug,
    );
    return NextResponse.json({ isFollowed });
  } catch (error) {
    console.error("[API_SUBSCRIPTIONS_CHECK_GET]:", error);
    return NextResponse.json({ isFollowed: false }, { status: 500 });
  }
}
