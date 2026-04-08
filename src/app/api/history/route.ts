import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { redis } from "@/lib/redis";
import { HistoryItem } from "@/lib/types";

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

    const { data: existing } = await supabase
      .from("watch_history")
      .select("episodes_progress")
      .eq("user_id", user.id)
      .eq("movie_slug", historyItem.movie_slug)
      .maybeSingle();

    // Merge episodes_progress
    const existingProgress = existing?.episodes_progress || {};
    const newProgress = historyItem.episodes_progress || {};

    // Tối ưu: Merge nhưng bảo vệ trạng thái 'ep_is_finished' = true vĩnh viễn
    const mergedProgress = { ...existingProgress };
    for (const slug in newProgress) {
      const newEp = newProgress[slug];
      const oldEp = mergedProgress[slug];

      mergedProgress[slug] = {
        ...newEp,
        // Nếu đã từng xong, thì mãi mãi xong
        ep_is_finished: oldEp?.ep_is_finished || newEp.ep_is_finished,
      };
    }

    // Determine correct last_episode_slug (dựa trên updated_at mới nhất)
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

    // Tính toán trạng thái phim chính xác từ DB
    const lastEpSlug = (historyItem as HistoryItem).last_episode_of_movie_slug;
    const isMovieCompletelyFinished =
      mergedProgress[lastEpSlug]?.ep_is_finished === true;

    // UPSERT
    const { error } = await supabase.from("watch_history").upsert(
      {
        user_id: user.id,
        device_id: historyItem.device_id || null,
        movie_slug: historyItem.movie_slug,
        movie_name: historyItem.movie_name,
        movie_poster: historyItem.movie_poster,
        last_episode_slug: correctLastEpSlug,
        last_episode_of_movie_slug: lastEpSlug,
        episodes_progress: mergedProgress,
        is_finished: isMovieCompletelyFinished,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,device_id,movie_slug" },
    );

    if (error) throw error;

    // Clear cache
    try {
      if (redis) await redis.del(`history_list:${user.id}`);
      if (redis)
        await redis.del(
          `history:user:${user.id}:movie:${historyItem.movie_slug}`,
        );
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
