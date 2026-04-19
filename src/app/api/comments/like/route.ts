import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { CommentService } from "@/services/comment.service";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const { commentId, movieSlug } = await request.json();
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const action = await CommentService.toggleLike(
      user.id,
      commentId,
      movieSlug,
    );
    return NextResponse.json({ success: true, action });
  } catch (error) {
    console.error("[API_COMMENTS_LIKE_POST]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
