import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { updateHistoryCache } from "@/lib/utils";
import { HistoryItem } from "@/lib/types";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { deviceId, localHistory } = body;

    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Khi Login thành công, Client gửi device_id lên. API sẽ tìm tất cả bản ghi có device_id này trong DB, cập nhật cột user_id thành ID của user hiện tại, set device_id = null.
    if (deviceId) {
      const { error: syncError } = await supabase
        .from("watch_history")
        .update({ user_id: user.id, device_id: null })
        .eq("device_id", deviceId);

      if (syncError) {
        console.error("Sync error:", syncError);
      }
    }

    // Hợp nhất lịch sử xem từ LocalStorage với Supabase
    if (localHistory && Array.isArray(localHistory)) {
      for (const item of localHistory as HistoryItem[]) {
        // Kiểm tra xem phim đã có trong Supabase chưa
        const { data: existingData } = await supabase
          .from("watch_history")
          .select("*")
          .eq("user_id", user.id)
          .eq("movie_slug", item.movie_slug)
          .single();

        if (existingData) {
          // Hợp nhất episodes_progress
          const existingProgress = existingData.episodes_progress || {};
          const mergedProgress = { ...existingProgress };

          for (const epSlug in item.episodes_progress) {
            const existingEp = existingProgress[epSlug];
            const newEp = item.episodes_progress[epSlug];

            // Giữ lại tiến độ cao nhất cho từng tập
            if (!existingEp || newEp.ep_last_time > existingEp.ep_last_time) {
              mergedProgress[epSlug] = newEp;
            }
          }

          // Tìm tập có ep_updated_at mới nhất để làm last_episode_slug
          let latestEpSlug = existingData.last_episode_slug || item.last_episode_slug;
          let latestTime = 0;
          for (const epSlug in mergedProgress) {
            const ep = mergedProgress[epSlug];
            const epTime = new Date(ep.ep_updated_at).getTime();
            if (epTime > latestTime) {
              latestTime = epTime;
              latestEpSlug = epSlug;
            }
          }

          // Cập nhật Supabase
          await supabase
            .from("watch_history")
            .update({
              episodes_progress: mergedProgress,
              last_episode_slug: latestEpSlug,
              is_finished: item.is_finished,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingData.id);
        } else {
          // Thêm mới vào Supabase
          await supabase.from("watch_history").insert({
            user_id: user.id,
            movie_slug: item.movie_slug,
            movie_name: item.movie_name,
            movie_poster: item.movie_poster,
            last_episode_slug: item.last_episode_slug,
            episodes_progress: item.episodes_progress,
            is_finished: item.is_finished,
            updated_at: new Date().toISOString(),
          });
        }

        // Cập nhật Redis cache
        await updateHistoryCache(user.id, undefined, {
          movie_slug: item.movie_slug,
          movie_name: item.movie_name,
          movie_poster: item.movie_poster,
          last_episode_slug: item.last_episode_slug,
          current_time: item.episodes_progress[item.last_episode_slug]?.ep_last_time || 0,
          duration: item.episodes_progress[item.last_episode_slug]?.ep_duration || 0,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}