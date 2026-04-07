import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { redis } from "@/lib/redis";
import { HistoryItem } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const historyItem: HistoryItem = await req.json();

    // Basic validation
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

    // Step 1: Fetch existing data to merge episodes_progress
    const { data: existing } = await supabase
      .from("watch_history")
      .select("episodes_progress, last_episode_slug")
      .eq("user_id", user.id)
      .eq("movie_slug", historyItem.movie_slug)
      .maybeSingle();

    // Step 2: Merge episodes_progress (keep existing episodes, add/update new ones)
    const existingProgress = existing?.episodes_progress || {};
    const newProgress = historyItem.episodes_progress || {};
    const mergedProgress = { ...existingProgress, ...newProgress };

    // Step 3: Determine the correct last_episode_slug based on most recently updated episode
    let correctLastEpSlug = historyItem.last_episode_slug;
    let latestEpTime = 0;
    for (const epSlug in mergedProgress) {
      const ep = mergedProgress[epSlug];
      if (ep?.ep_updated_at) {
        const epTime = new Date(ep.ep_updated_at).getTime();
        if (epTime > latestEpTime) {
          latestEpTime = epTime;
          correctLastEpSlug = epSlug;
        }
      }
    }

    // Step 4: UPSERT with merged data and correct last_episode_slug
    const { error } = await supabase.from("watch_history").upsert(
      {
        user_id: user.id,
        device_id: historyItem.device_id || null,
        movie_slug: historyItem.movie_slug,
        movie_name: historyItem.movie_name,
        movie_poster: historyItem.movie_poster,
        last_episode_slug: correctLastEpSlug,
        episodes_progress: mergedProgress,
        is_finished: historyItem.is_finished,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,device_id,movie_slug" },
    );

    if (error) throw error;

    try {
      if (redis) await redis.del(`history_list:${user.id}`);
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
