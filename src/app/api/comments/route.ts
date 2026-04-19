import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { CommentService } from "@/services/comment.service";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const movieSlug = searchParams.get("movieSlug");
    if (!movieSlug)
      return NextResponse.json({ error: "Missing movieSlug" }, { status: 400 });

    const parentId = searchParams.get("parentId");
    const limit = parseInt(searchParams.get("limit") || "5");
    const cursor = searchParams.get("cursor");

    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const data = await CommentService.getList(
      movieSlug,
      parentId,
      cursor,
      limit,
      user?.id,
    );
    return NextResponse.json(data);
  } catch (error) {
    console.error("[API_COMMENTS_GET]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const comment = await CommentService.addComment(user.id, body);
    return NextResponse.json({ success: true, comment });
  } catch (error) {
    console.error("[API_COMMENTS_POST]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get("id");
    const movieSlug = searchParams.get("movieSlug");
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !commentId || !movieSlug)
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });

    await CommentService.deleteComment(user.id, commentId, movieSlug);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API_COMMENTS_DELETE]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
