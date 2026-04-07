import { NextResponse } from "next/server";
import { getHistoryCache } from "@/lib/utils";
import { createSupabaseServer } from "@/lib/supabase/server";
import { HistoryItem } from "@/lib/types";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || undefined;
    const deviceId = searchParams.get("deviceId") || undefined;

    // Lấy dữ liệu từ Redis HGETALL.
    let historyList: HistoryItem[] = [];
    const cachedData = await getHistoryCache(userId, deviceId);

    if (cachedData) {
      // Nếu có cache trong Redis, sử dụng nó
      historyList = Object.values(cachedData);
    } else {
      // Nếu Redis rỗng (Cache miss), truy vấn vào Supabase. Lấy xong ghi ngược lại Redis (Backfill).
      const supabase = await createSupabaseServer();
      let query = supabase
        .from("watch_history")
        .select("*")
        .order("updated_at", { ascending: false });

      if (userId) {
        query = query.eq("user_id", userId);
      } else if (deviceId) {
        query = query.eq("device_id", deviceId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Supabase error:", error);
        return NextResponse.json([]);
      }

      if (data) {
        historyList = data.map((item) => ({
          id: item.id,
          user_id: item.user_id,
          device_id: item.device_id,
          movie_slug: item.movie_slug,
          movie_name: item.movie_name,
          movie_poster: item.movie_poster,
          last_episode_slug: item.last_episode_slug,
          episodes_progress: item.episodes_progress || {},
          is_finished: item.is_finished || false,
          updated_at: item.updated_at,
        }));
      }
    }

    // Sắp xếp danh sách trả về theo updated_at giảm dần.
    historyList.sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    return NextResponse.json(historyList);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}