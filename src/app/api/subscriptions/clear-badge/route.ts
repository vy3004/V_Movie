import { createSupabaseServer } from "@/lib/supabase/server";
import { updateSubscriptionCache } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { movieSlug } = await req.json();
    if (!movieSlug) {
      return NextResponse.json({ error: "Missing movieSlug" }, { status: 400 });
    }

    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 1. Cập nhật Supabase: set has_new_episode = false
    const { data, error } = await supabase
      .from("user_subscriptions")
      .update({ has_new_episode: false })
      .eq("user_id", user.id)
      .eq("movie_slug", movieSlug)
      .select();

    if (error) throw error;

    // 2. Cập nhật Redis Cache ngay lập tức để đồng bộ dữ liệu
    // Hành động "update" sẽ ghi đè bản ghi mới vào Hash của User
    if (data && data.length > 0) {
      await updateSubscriptionCache(user.id, "update", data[0]);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CLEAR_BADGE_ERROR]:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
