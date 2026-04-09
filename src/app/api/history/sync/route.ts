import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { updateHistoryCache } from "@/lib/utils";
import { HistoryItem, EpisodeProgress } from "@/lib/types";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      deviceId,
      localHistory,
    }: { deviceId?: string; localHistory: HistoryItem[] } = body;

    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 1. Sync ownership: Chuyển bản ghi từ device_id sang user_id
    if (deviceId) {
      await supabase
        .from("watch_history")
        .update({ user_id: user.id, device_id: null })
        .eq("device_id", deviceId);
    }

    // 2. Hợp nhất lịch sử
    if (localHistory && Array.isArray(localHistory)) {
      for (const item of localHistory) {
        const { data: existingData } = await supabase
          .from("watch_history")
          .select("*")
          .eq("user_id", user.id)
          .eq("movie_slug", item.movie_slug)
          .maybeSingle();

        const existingProgress =
          (existingData?.episodes_progress as Record<
            string,
            EpisodeProgress
          >) || {};
        const mergedProgress = { ...existingProgress };

        // Hợp nhất tiến độ tập
        for (const epSlug in item.episodes_progress) {
          const newEp = item.episodes_progress[epSlug];
          const oldEp = existingProgress[epSlug];

          mergedProgress[epSlug] = {
            ep_last_time: newEp.ep_last_time,
            ep_duration: newEp.ep_duration,
            // LOGIC VĨNH VIỄN: Nếu đã từng xong (true), thì mãi là true
            ep_is_finished: oldEp?.ep_is_finished || newEp.ep_is_finished,
            ep_updated_at: newEp.ep_updated_at,
          };
        }

        // Tính tập cuối mới nhất
        let latestEpSlug = item.last_episode_slug;
        let latestTime = 0;
        for (const epSlug in mergedProgress) {
          const epTime = new Date(
            mergedProgress[epSlug].ep_updated_at,
          ).getTime();
          if (epTime > latestTime) {
            latestTime = epTime;
            latestEpSlug = epSlug;
          }
        }

        // LOGIC PHIM XONG: Sử dụng field đã được định nghĩa trong HistoryItem
        const lastEpSlug = item.last_episode_of_movie_slug;
        const isMovieCompletelyFinished =
          mergedProgress[lastEpSlug]?.ep_is_finished === true;

        const updatePayload = {
          user_id: user.id,
          movie_slug: item.movie_slug,
          movie_name: item.movie_name,
          movie_poster: item.movie_poster,
          last_episode_slug: latestEpSlug,
          episodes_progress: mergedProgress,
          is_finished: isMovieCompletelyFinished,
          updated_at: new Date().toISOString(),
        };

        if (existingData) {
          const { error: updateError } = await supabase
            .from("watch_history")
            .update(updatePayload)
            .eq("id", existingData.id);
          if (updateError) {
            console.error(
              `[SYNC_HISTORY] Failed to update ${item.movie_slug}:`,
              updateError,
            );
          }
        } else {
          const { error: insertError } = await supabase
            .from("watch_history")
            .insert(updatePayload);
          if (insertError) {
            console.error(
              `[SYNC_HISTORY] Failed to insert ${item.movie_slug}:`,
              insertError,
            );
          }
        }

        // Cập nhật Redis Cache
        await updateHistoryCache(user.id, undefined, {
          movie_slug: item.movie_slug,
          movie_name: item.movie_name,
          movie_poster: item.movie_poster,
          last_episode_slug: latestEpSlug,
          last_episode_of_movie_slug: lastEpSlug,
          current_time: mergedProgress[latestEpSlug]?.ep_last_time || 0,
          duration: mergedProgress[latestEpSlug]?.ep_duration || 0,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SYNC_HISTORY_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
