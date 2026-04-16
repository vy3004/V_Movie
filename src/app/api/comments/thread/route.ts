import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { CommentService } from "@/services/comment.service";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get("id");
    if (!commentId)
      return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const data = await CommentService.getThreadLineage(commentId, user?.id);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
