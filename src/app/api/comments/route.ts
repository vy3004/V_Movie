import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { redis } from "@/lib/redis";
import { CommentItem } from "@/lib/types";

export const runtime = "edge";

const PAGINATION_LIMIT = 5;
const COMMENT_CACHE_TTL = 300; // 5 phút
const TOTAL_CACHE_TTL = 3600; // 1 tiếng
const VERSION_TTL = 60 * 60 * 24 * 15; // 15 ngày

interface SupabaseRawComment extends Omit<
  CommentItem,
  "replies_count" | "is_liked_by_me"
> {
  replies_count: { count: number }[];
}

const getMovieCommentVersion = async (movieSlug: string) => {
  const versionKey = `comments:version:${movieSlug}`;
  let version = await redis?.get<string>(versionKey);
  if (!version) {
    version = "0";
    await redis?.set(versionKey, version, { ex: VERSION_TTL });
  }
  return version;
};

// ==========================================
// 1. GET: Lấy danh sách bình luận HOẶC lấy theo IDs gia phả
// ==========================================
// app/api/comments/route.ts (Chỉ thay thế hàm GET)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const movieSlug = searchParams.get("movieSlug");
    const parentId = searchParams.get("parentId");
    const ids = searchParams.get("ids");
    const limit = parseInt(
      searchParams.get("limit") || PAGINATION_LIMIT.toString(),
    );
    const cursor = searchParams.get("cursor");
    const forceRefresh = searchParams.get("refresh") === "true";

    if (!movieSlug)
      return NextResponse.json({ error: "Missing movieSlug" }, { status: 400 });

    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // --- TRƯỜNG HỢP: NẠP THEO DANH SÁCH ID (GIA PHẢ TỪ THÔNG BÁO) ---
    if (ids) {
      const idArray = ids.split(",");
      const { data, error } = await supabase
        .from("comments")
        .select(
          `*, profiles:user_id(full_name, avatar_url), replies_count:comments!parent_id(count)`,
        )
        .in("id", idArray);

      if (error) throw error;

      let formatted = (data as unknown as SupabaseRawComment[]).map((c) => ({
        ...c,
        replies_count: c.replies_count?.[0]?.count || 0,
        is_liked_by_me: false,
      }));

      if (user && formatted.length > 0) {
        const { data: likes } = await supabase
          .from("comment_likes")
          .select("comment_id")
          .eq("user_id", user.id)
          .in("comment_id", idArray);
        const likedSet = new Set(likes?.map((l) => l.comment_id) || []);
        formatted = formatted.map((c) => ({
          ...c,
          is_liked_by_me: likedSet.has(c.id),
        }));
      }
      return NextResponse.json(formatted);
    }

    // --- TRƯỜNG HỢP: LẤY DANH SÁCH PHÂN TRANG (CÓ REDIS CACHE) ---
    const version = await getMovieCommentVersion(movieSlug);
    const cacheKey = `comments:${movieSlug}:v${version}:${parentId || "root"}:${cursor || "top"}`;
    const totalCacheKey = `comments:total:${movieSlug}:${parentId || "root"}`;

    let comments: CommentItem[] = [];
    let totalCount = 0;

    // --- PHẦN 1: LẤY TỔNG SỐ LƯỢNG ---
    if (!cursor || forceRefresh) {
      const cachedTotal = !forceRefresh
        ? await redis?.get<number>(totalCacheKey)
        : null;
      if (cachedTotal !== null && cachedTotal !== undefined) {
        totalCount = cachedTotal;
      } else {
        const { count } = await supabase
          .from("comments")
          .select("*", { count: "exact", head: true })
          .eq("movie_slug", movieSlug)
          .filter("parent_id", parentId ? "eq" : "is", parentId || null);

        totalCount = count || 0;
        if (redis)
          await redis.set(totalCacheKey, totalCount, { ex: TOTAL_CACHE_TTL });
      }
    }

    // --- PHẦN 2: LẤY DANH SÁCH ITEMS ---
    const cachedData = !forceRefresh
      ? await redis?.get<CommentItem[]>(cacheKey)
      : null;
    if (cachedData) {
      comments = cachedData;
    } else {
      let query = supabase
        .from("comments")
        .select(
          `*, profiles:user_id(full_name, avatar_url), replies_count:comments!parent_id(count)`,
        )
        .eq("movie_slug", movieSlug)
        .limit(limit);

      if (parentId) {
        query = query
          .eq("parent_id", parentId)
          .order("created_at", { ascending: true });
        if (cursor) query = query.gt("created_at", cursor);
      } else {
        query = query
          .is("parent_id", null)
          .order("created_at", { ascending: false });
        if (cursor) query = query.lt("created_at", cursor);
      }

      const { data, error } = await query;
      if (error) throw error;

      comments = (data as unknown as SupabaseRawComment[]).map((c) => ({
        ...c,
        replies_count: c.replies_count?.[0]?.count || 0,
        is_liked_by_me: false,
      }));

      if (redis && comments.length > 0) {
        await redis.set(cacheKey, comments, { ex: COMMENT_CACHE_TTL });
      }
    }

    // --- PHẦN 3: LIKE STATUS (Dành cho User Login) ---
    if (user && comments.length > 0) {
      const commentIds = comments.map((c) => c.id);
      const { data: userLikes } = await supabase
        .from("comment_likes")
        .select("comment_id")
        .eq("user_id", user.id)
        .in("comment_id", commentIds);

      const likedSet = new Set(userLikes?.map((like) => like.comment_id) || []);
      comments = comments.map((comment) => ({
        ...comment,
        is_liked_by_me: likedSet.has(comment.id),
      }));
    }

    return NextResponse.json({ items: comments, total: totalCount });
  } catch (error) {
    console.error("[GET_COMMENTS_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

// ==========================================
// 2. POST: Đăng bình luận + Xây dựng Path
// ==========================================
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { movieSlug, movieName, content, parentId, replyToId, rootId } = body;

    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // LOGIC XÂY DỰNG GIA PHẢ CHUẨN XÁC
    let path: string[] = [];
    const pathBuilderId = replyToId || parentId;

    if (pathBuilderId) {
      const { data: ancestor } = await supabase
        .from("comments")
        .select("path")
        .eq("id", pathBuilderId)
        .single();

      if (!ancestor) {
        return NextResponse.json(
          { error: "Parent comment not found" },
          { status: 404 },
        );
      }

      // Nối ID của tổ tiên vào mảng đường đi
      path = ancestor?.path
        ? [...ancestor.path, pathBuilderId]
        : [pathBuilderId];
    }

    // 1. Lưu Comment vào Database
    const { data: newComment, error } = await supabase
      .from("comments")
      .insert({
        user_id: user.id,
        movie_slug: movieSlug,
        content: content,
        parent_id: parentId || null,
        reply_to_id: replyToId || null,
        path: path, // Lưu mảng ID phục vụ cho việc móc nguyên cây
      })
      .select("*, profiles:user_id(full_name, avatar_url)")
      .single();

    if (error) throw error;

    // 2. Dọn dẹp Cache
    if (redis) {
      await redis.incr(`comments:version:${movieSlug}`);
      await redis.del(`comments:total:${movieSlug}:${parentId || "root"}`);
    }

    // 3. Logic Thông báo Reply
    const targetNotifyId = replyToId || parentId;
    if (targetNotifyId) {
      const { data: targetComment } = await supabase
        .from("comments")
        .select("user_id")
        .eq("id", targetNotifyId)
        .single();

      if (targetComment && targetComment.user_id !== user.id) {
        await supabase.from("notifications").insert({
          user_id: targetComment.user_id,
          type: "comment_reply",
          movie_slug: movieSlug,
          movie_name: movieName,
          actor_name: user.user_metadata?.full_name || "Người dùng",
          content: `đã trả lời bình luận của bạn`,
          metadata: {
            comment_id: newComment.id,
            parent_id: parentId, // Parent hiển thị trên UI
            root_id: rootId || parentId, // Root ID để Focus
            comment_path: [...path, newComment.id], // Lộ trình full path:[Root, ..., Parent, Current]
            thumb_url: user.user_metadata?.avatar_url,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      comment: { ...newComment, replies_count: 0, is_liked_by_me: false },
    });
  } catch (error) {
    console.error("[POST_COMMENT_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

// ==========================================
// 3. DELETE: Xóa bình luận
// ==========================================
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

    const { data: target } = await supabase
      .from("comments")
      .select("parent_id")
      .eq("id", commentId)
      .single();

    const { error } = await supabase
      .from("comments")
      .delete()
      .eq("id", commentId)
      .eq("user_id", user.id);
    if (error) throw error;

    if (redis) {
      await redis.incr(`comments:version:${movieSlug}`);
      await redis.del(
        `comments:total:${movieSlug}:${target?.parent_id || "root"}`,
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE_COMMENT_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
