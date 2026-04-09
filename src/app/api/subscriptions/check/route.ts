import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getSubscriptionCache } from "@/lib/utils";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const movieSlug = searchParams.get("movieSlug");

    if (!movieSlug)
      return NextResponse.json({ error: "Missing movieSlug" }, { status: 400 });

    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Guest -> Trả về false (Vì UI Guest đọc trực tiếp từ LocalStorage)
    if (!user) return NextResponse.json({ isFollowed: false });

    // 1. Check Redis trước (Nhanh nhất)
    const cachedData = await getSubscriptionCache(user.id);
    if (cachedData) {
      const isFollowed = !!cachedData[movieSlug];
      return NextResponse.json({ isFollowed });
    }

    // 2. Cache Miss -> Check Supabase
    const { data, error } = await supabase
      .from("user_subscriptions")
      .select("movie_slug")
      .eq("user_id", user.id)
      .eq("movie_slug", movieSlug)
      .maybeSingle();

    if (error) throw error;

    const isFollowed = !!data;
    return NextResponse.json({ isFollowed });
  } catch (error) {
    console.error("[CHECK_SUBSCRIPTION_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
