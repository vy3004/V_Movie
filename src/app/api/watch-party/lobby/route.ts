import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";

    const supabase = await createSupabaseServer();

    let query = supabase
      .from("watch_party_rooms")
      .select(
        `
        id, room_code, title, current_movie_slug, current_episode_slug, 
        is_private, created_at, movie_image, max_participants, participant_count,
        host:profiles!host_id(full_name, avatar_url)
      `,
      )
      .eq("is_active", true)
      // DỌN DẸP PHÒNG TRỐNG: Đảm bảo không hiện phòng ma nếu Trigger xóa chưa kịp chạy hết.
      .gt("participant_count", 0)
      .order("created_at", { ascending: false })
      .limit(50);

    if (search) {
      // 1. Khớp room_code (hiện cả Public & Private)
      // 2. HOẶC (Phòng phải là Public AND (khớp tiêu đề OR khớp slug phim))
      query = query.or(
        `room_code.ilike.%${search}%,and(is_private.eq.false,title.ilike.%${search}%),and(is_private.eq.false,current_movie_slug.ilike.%${search}%)`,
      );
    } else {
      // Nếu không search, mặc định chỉ hiện phòng công khai
      query = query.eq("is_private", false);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[WP_LIST_DB_ERROR]:", error);
      return NextResponse.json(
        { error: "Không thể tải danh sách phòng" },
        { status: 500 },
      );
    }

    return NextResponse.json({ rooms: data });
  } catch (error) {
    console.error("[WP_LIST_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
