import "server-only";
import { createSupabaseServer } from "@/lib/supabase/server";
import { redis } from "@/lib/redis";
import { CommentItem, SupabaseRawComment } from "@/types";

const PAGINATION_LIMIT = 5;
const COMMENT_CACHE_TTL = 300; // 5 phút
const TOTAL_CACHE_TTL = 3600; // 1 tiếng
const VERSION_TTL = 60 * 60 * 24 * 15; // 15 ngày

export const CommentService = {
  // 1. Helper: Quản lý Version Cache (Để invalidation nhanh chóng)
  getMovieCommentVersion: async (movieSlug: string) => {
    const versionKey = `comments:version:${movieSlug}`;
    let version = redis ? await redis.get<string>(versionKey) : null;
    if (!version) {
      version = "0";
      if (redis) await redis.set(versionKey, version, { ex: VERSION_TTL });
    }
    return version;
  },

  incrementCacheVersion: async (
    movieSlug: string,
    parentId?: string | null,
  ) => {
    if (redis) {
      await redis.incr(`comments:version:${movieSlug}`);
      await redis.del(`comments:total:${movieSlug}:${parentId || "root"}`);
    }
  },

  // 2. GET: Lấy danh sách bình luận (Phân trang + Redis Cache)
  getList: async (
    movieSlug: string,
    parentId: string | null,
    cursor: string | null,
    limit: number = PAGINATION_LIMIT,
    userId?: string,
  ) => {
    const supabase = await createSupabaseServer();
    const version = await CommentService.getMovieCommentVersion(movieSlug);

    const cacheKey = `comments:${movieSlug}:v${version}:${parentId || "root"}:${cursor || "top"}`;
    const totalCacheKey = `comments:total:${movieSlug}:${parentId || "root"}`;

    let comments: CommentItem[] = [];
    let totalCount = 0;

    // Lấy Total Count
    if (!cursor) {
      const cachedTotal = redis ? await redis.get<number>(totalCacheKey) : null;
      if (cachedTotal !== null) {
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

    // Lấy Danh sách Items
    const cachedData = redis ? await redis.get<CommentItem[]>(cacheKey) : null;
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

    // Gắn trạng thái Like của User hiện tại
    if (userId && comments.length > 0) {
      const commentIds = comments.map((c) => c.id);
      const { data: userLikes } = await supabase
        .from("comment_likes")
        .select("comment_id")
        .eq("user_id", userId)
        .in("comment_id", commentIds);

      const likedSet = new Set(userLikes?.map((l) => l.comment_id) || []);
      comments = comments.map((c) => ({
        ...c,
        is_liked_by_me: likedSet.has(c.id),
      }));
    }

    return { items: comments, total: totalCount };
  },

  // 3. GET: Lấy Cây Gia Phả (Thread Lineage)
  getThreadLineage: async (
    commentId: string,
    userId?: string,
  ): Promise<CommentItem[]> => {
    const supabase = await createSupabaseServer();
    const { data: targetData } = await supabase
      .from("comments")
      .select("path")
      .eq("id", commentId)
      .single();

    if (!targetData) return [];
    const fullLineageIds = [...(targetData.path || []), commentId];

    const { data } = await supabase
      .from("comments")
      .select(
        `*, profiles:user_id(full_name, avatar_url), replies_count:comments!parent_id(count)`,
      )
      .in("id", fullLineageIds);

    if (!data) return [];

    let formatted = (data as unknown as SupabaseRawComment[]).map((c) => ({
      ...c,
      replies_count: c.replies_count?.[0]?.count || 0,
      is_liked_by_me: false,
    }));

    if (userId && formatted.length > 0) {
      const { data: userLikes } = await supabase
        .from("comment_likes")
        .select("comment_id")
        .eq("user_id", userId)
        .in("comment_id", fullLineageIds);
      const likedSet = new Set(userLikes?.map((l) => l.comment_id) || []);
      formatted = formatted.map((c) => ({
        ...c,
        is_liked_by_me: likedSet.has(c.id),
      }));
    }

    // Trả về đúng thứ tự cây gia phả (Tổ tiên -> Con)
    return fullLineageIds
      .map((id) => formatted.find((item) => item.id === id))
      .filter(Boolean) as CommentItem[];
  },

  // 4. POST: Thêm Comment mới & Bắn Thông báo
  addComment: async (userId: string, body: any) => {
    const { movieSlug, movieName, content, parentId, replyToId, rootId } = body;
    const supabase = await createSupabaseServer();

    let path: string[] = [];
    const pathBuilderId = replyToId || parentId;

    if (pathBuilderId) {
      const { data: ancestor } = await supabase
        .from("comments")
        .select("path")
        .eq("id", pathBuilderId)
        .single();
      path = ancestor?.path
        ? [...ancestor.path, pathBuilderId]
        : [pathBuilderId];
    }

    // Insert Comment
    const { data: newComment, error } = await supabase
      .from("comments")
      .insert({
        user_id: userId,
        movie_slug: movieSlug,
        content,
        parent_id: parentId || null,
        reply_to_id: replyToId || null,
        path,
      })
      .select("*, profiles:user_id(full_name, avatar_url)")
      .single();

    if (error) throw error;

    await CommentService.incrementCacheVersion(movieSlug, parentId);

    // Xử lý Thông báo
    const targetNotifyId = replyToId || parentId;
    if (targetNotifyId) {
      const { data: targetComment } = await supabase
        .from("comments")
        .select("user_id")
        .eq("id", targetNotifyId)
        .single();
      const { data: actorProfile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", userId)
        .single();

      if (targetComment && targetComment.user_id !== userId) {
        await supabase.from("notifications").insert({
          user_id: targetComment.user_id,
          type: "comment_reply",
          movie_slug: movieSlug,
          movie_name: movieName,
          actor_name: actorProfile?.full_name || "Người dùng",
          content: `đã trả lời bình luận của bạn`,
          metadata: {
            comment_id: newComment.id,
            parent_id: parentId,
            root_id: rootId || parentId,
            comment_path: [...path, newComment.id],
            thumb_url: actorProfile?.avatar_url,
          },
        });
      }
    }

    return { ...newComment, replies_count: 0, is_liked_by_me: false };
  },

  // 5. DELETE: Xóa Comment
  deleteComment: async (
    userId: string,
    commentId: string,
    movieSlug: string,
  ) => {
    const supabase = await createSupabaseServer();
    const { data: target } = await supabase
      .from("comments")
      .select("parent_id")
      .eq("id", commentId)
      .single();

    const { data: deleted, error } = await supabase
      .from("comments")
      .delete()
      .eq("id", commentId)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();

    if (error) throw error;

    if (!deleted) {
      throw new Error("Comment not found or unauthorized");
    }

    await CommentService.incrementCacheVersion(movieSlug, target?.parent_id);
  },

  // 6. POST: Toggle Like
  toggleLike: async (userId: string, commentId: string, movieSlug: string) => {
    const supabase = await createSupabaseServer();
    const { data: existing } = await supabase
      .from("comment_likes")
      .select("*")
      .eq("user_id", userId)
      .eq("comment_id", commentId)
      .maybeSingle();

    if (existing) {
      const { error: deleteError } = await supabase
        .from("comment_likes")
        .delete()
        .eq("user_id", userId)
        .eq("comment_id", commentId);
      if (deleteError) throw deleteError;
    } else {
      const { error: insertError } = await supabase
        .from("comment_likes")
        .insert({ user_id: userId, comment_id: commentId });
      if (insertError) throw insertError;
    }

    await CommentService.incrementCacheVersion(movieSlug);
    return existing ? "unliked" : "liked";
  },
};
