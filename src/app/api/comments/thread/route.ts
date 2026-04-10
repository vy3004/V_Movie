import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { CommentItem, SupabaseRawComment } from "@/lib/types";

export const runtime = "edge";

/**
 * API GET THREAD: Lấy "Xương sống" gia phả của một bình luận.
 * Đầu vào: ?id=[TARGET_ID]
 * Trả về: Mảng [Root, Con, Cháu, ..., Target]
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get("id");

    if (!commentId) {
      return NextResponse.json({ error: "Missing commentId" }, { status: 400 });
    }

    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // 1. TÌM COMMENT MỤC TIÊU ĐỂ LẤY MẢNG PATH (GIA PHẢ)
    // Cột path chúng ta đã tạo lưu mảng ID các tổ tiên: [RootID, ParentID]
    const { data: targetData, error: targetErr } = await supabase
      .from("comments")
      .select("path")
      .eq("id", commentId)
      .single();

    if (targetErr || !targetData) {
      return NextResponse.json([]); // Không tìm thấy hoặc bị xóa
    }

    // 2. GỘP [Mảng cha ông] + [ID chính nó] thành lộ trình đầy đủ
    const fullLineageIds = [...(targetData.path || []), commentId];

    // 3. BỐC TOÀN BỘ THÔNG TIN CỦA CÁC COMMENT TRONG LỘ TRÌNH
    const { data, error } = await supabase
      .from("comments")
      .select(
        `
        *, 
        profiles:user_id(full_name, avatar_url), 
        replies_count:comments!parent_id(count)
      `,
      )
      .in("id", fullLineageIds);

    if (error) throw error;

    // 4. ÉP KIỂU VÀ FORMAT DỮ LIỆU CHUẨN INTERFACE
    const rawData = data as unknown as SupabaseRawComment[];
    let formatted = rawData.map((c) => ({
      ...c,
      replies_count: c.replies_count?.[0]?.count || 0,
      is_liked_by_me: false, // Mặc định là false
    }));

    // 5. NẾU USER ĐĂNG NHẬP -> CHECK LIKE CHO TOÀN BỘ NHÁNH
    if (user && formatted.length > 0) {
      const { data: userLikes } = await supabase
        .from("comment_likes")
        .select("comment_id")
        .eq("user_id", user.id)
        .in("comment_id", fullLineageIds);

      const likedSet = new Set(userLikes?.map((like) => like.comment_id) || []);

      formatted = formatted.map((comment) => ({
        ...comment,
        is_liked_by_me: likedSet.has(comment.id),
      }));
    }

    // 6. Sắp xếp lại theo đúng thứ tự mảng ID
    // (Đảm bảo trả về từ Tổ tiên -> Con -> Cháu để UI vẽ cây đúng hướng)
    const sortedResult = fullLineageIds
      .map((id) => formatted.find((item) => item.id === id))
      .filter(Boolean) as CommentItem[];

    return NextResponse.json(sortedResult);
  } catch (error) {
    console.error("[GET_THREAD_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
