import { NextResponse } from "next/server";
import { getHistoryCache } from "@/lib/utils";
import { createSupabaseServer } from "@/lib/supabase/server";
import { HistoryItem } from "@/lib/types";
import { redis } from "@/lib/redis"; // Import thêm redis để backfill

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || undefined;
    const deviceId = searchParams.get("deviceId") || undefined;

    if (!userId && !deviceId) {
      return NextResponse.json({ error: "Missing identity" }, { status: 400 });
    }

    let historyList: HistoryItem[] = [];

    // 1. Thử lấy từ Redis
    const cachedData = await getHistoryCache(userId, deviceId);

    if (cachedData) {
      historyList = Object.values(cachedData);
    } else {
      // 2. Cache Miss: Truy vấn từ Supabase
      const supabase = await createSupabaseServer();
      let query = supabase
        .from("watch_history")
        .select("*")
        .order("updated_at", { ascending: false });

      if (userId) query = query.eq("user_id", userId);
      else if (deviceId) query = query.eq("device_id", deviceId);

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        historyList = data.map((item) => ({
          id: item.id,
          user_id: item.user_id,
          device_id: item.device_id,
          movie_slug: item.movie_slug,
          movie_name: item.movie_name,
          movie_poster: item.movie_poster,
          last_episode_slug: item.last_episode_slug,
          last_episode_of_movie_slug: item.last_episode_of_movie_slug,
          episodes_progress: item.episodes_progress || {},
          is_finished: item.is_finished || false,
          updated_at: item.updated_at,
        }));

        // 3. Backfill vào Redis để lần sau truy cập nhanh hơn
        if (redis && historyList.length > 0) {
          const key = userId
            ? `history:user:${userId}`
            : `history:device:${deviceId}`;
          const redisMap = historyList.reduce(
            (acc, item) => {
              acc[item.movie_slug] = JSON.stringify(item);
              return acc;
            },
            {} as Record<string, string>,
          );

          await redis.hset(key, redisMap);
          await redis.expire(key, 60 * 60 * 24 * 7); // 7 ngày
        }
      }
    }

    // 4. Sắp xếp danh sách trả về theo updated_at giảm dần
    historyList.sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );

    return NextResponse.json(historyList);
  } catch (error) {
    console.error("[GET_HISTORY_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
