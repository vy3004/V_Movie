import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { redis } from "@/lib/redis";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const { commentId, movieSlug } = await request.json();

    if (!commentId || !movieSlug) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Kiểm tra trạng thái Like hiện tại
    const { data: existingLike } = await supabase
      .from("comment_likes")
      .select("*")
      .eq("user_id", user.id)
      .eq("comment_id", commentId)
      .maybeSingle();

    if (existingLike) {
      // Bỏ Like
      const { error: deleteError } = await supabase
        .from("comment_likes")
        .delete()
        .eq("user_id", user.id)
        .eq("comment_id", commentId);
      if (deleteError) throw deleteError;
    } else {
      // Like
      const { error: insertError } = await supabase
        .from("comment_likes")
        .insert({ user_id: user.id, comment_id: commentId });
      if (insertError) throw insertError;
    }

    // TĂNG PHIÊN BẢN CACHE (Version Invalidation)
    // Ép mọi client đang cache Redis phải chọc thẳng DB ở lượt F5 tới
    if (redis) {
      const versionKey = `comments:version:${movieSlug}`;
      await redis.incr(versionKey);
      await redis.expire(versionKey, 60 * 60 * 24 * 30);
    }

    return NextResponse.json({
      success: true,
      action: existingLike ? "unliked" : "liked",
    });
  } catch (error) {
    console.error("[TOGGLE_LIKE_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
