import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { redis } from "@/lib/redis";
import { HistoryItem, EpisodeProgress } from "@/lib/types";
import { getHistoryCacheKey } from "@/lib/utils";

export async function POST(req: Request) {
  try {
    const historyItem: HistoryItem = await req.json();

    if (!historyItem?.movie_slug || !historyItem?.last_episode_slug) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // BƯỚC 1: Lấy dữ liệu hiện tại dựa trên user_id và movie_slug (Bỏ qua device_id khi đã login)
    const { data: existing } = await supabase
      .from("watch_history")
      .select("episodes_progress, last_episode_of_movie_slug, is_finished")
      .eq("user_id", user.id)
      .eq("movie_slug", historyItem.movie_slug)
      .maybeSingle();

    // BƯỚC 2: Merge episodes_progress một cách an toàn
    const existingProgress =
      (existing?.episodes_progress as Record<string, EpisodeProgress>) || {};
    const newProgress =
      (historyItem.episodes_progress as Record<string, EpisodeProgress>) || {};

    // Khởi tạo merged bằng bản sao của dữ liệu cũ trong DB
    const mergedProgress = { ...existingProgress };

    // Duyệt qua dữ liệu mới gửi lên để cập nhật hoặc thêm vào bản cũ
    for (const slug in newProgress) {
      const newEp = newProgress[slug];
      const oldEp = mergedProgress[slug];

      mergedProgress[slug] = {
        ...newEp,
        ep_is_finished: oldEp?.ep_is_finished || newEp.ep_is_finished,
      };
    }

    // BƯỚC 3: Xác định last_episode_slug chuẩn (tập nào có updated_at mới nhất)
    let correctLastEpSlug = historyItem.last_episode_slug;
    let latestEpTime = 0;
    for (const epSlug in mergedProgress) {
      const ep = mergedProgress[epSlug];
      const epTime = new Date(ep.ep_updated_at).getTime();
      if (epTime > latestEpTime) {
        latestEpTime = epTime;
        correctLastEpSlug = epSlug;
      }
    }

    // BƯỚC 4: Xác định tập cuối của phim và trạng thái hoàn thành
    // Ưu tiên lấy từ payload, nếu không có thì lấy từ DB cũ
    const lastEpOfMovie =
      historyItem.last_episode_of_movie_slug ||
      existing?.last_episode_of_movie_slug;

    // Phim xong khi tập cuối đã xong (ưu tiên giữ true nếu đã xong từ trước)
    const isMovieCompletelyFinished =
      existing?.is_finished ||
      (lastEpOfMovie && mergedProgress[lastEpOfMovie]?.ep_is_finished === true);

    // BƯỚC 5: UPSERT
    const { error } = await supabase.from("watch_history").upsert(
      {
        user_id: user.id,
        device_id: historyItem.device_id || null,
        movie_slug: historyItem.movie_slug,
        movie_name: historyItem.movie_name,
        movie_poster: historyItem.movie_poster,
        last_episode_slug: correctLastEpSlug,
        last_episode_of_movie_slug: lastEpOfMovie,
        episodes_progress: mergedProgress,
        is_finished: isMovieCompletelyFinished,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,movie_slug" },
    );

    if (error) throw error;

    // Clear cache Redis
    try {
      if (redis) {
        const cacheKey = getHistoryCacheKey(user.id, undefined);
        if (cacheKey) await redis.del(cacheKey);
        await redis.del(
          `history:user:${user.id}:movie:${historyItem.movie_slug}`,
        );
      }
    } catch (redisErr) {
      console.warn("[REDIS_WARN] Could not clear history cache:", redisErr);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API_HISTORY_POST_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
