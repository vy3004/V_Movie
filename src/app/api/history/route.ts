import { redis } from "@/lib/redis";
import { createSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { movieSlug, episodeSlug, lastTime, duration, nextEpisodeSlug, isSync, localHistory } = body;
    
    const supabase = await createSupabaseServer();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const listCacheKey = `history_list:${user.id}`;

    // 1. ĐỒNG BỘ HÀNG LOẠT KHI ĐĂNG NHẬP
    if (isSync && localHistory) {
      const syncData = localHistory.map((h: any) => ({
        user_id: user.id,
        movie_slug: h.movieSlug,
        movie_name: h.movieName,
        movie_poster: h.moviePoster,
        last_episode_slug: h.last_episode_slug,
        episodes_progress: h.episodes_progress,
        is_finished: !!h.is_finished,
        updated_at: h.updated_at || new Date().toISOString(),
      }));
      await supabase.from("watch_history").upsert(syncData, { onConflict: "user_id, movie_slug" });
      if (redis) await redis.del(listCacheKey);
      return NextResponse.json({ success: true });
    }

    // 2. LOGIC LƯU TIẾN TRÌNH CHI TIẾT
    const isFinishedCurrent = lastTime > duration * 0.95;
    const { data: existing } = await supabase
      .from("watch_history")
      .select("episodes_progress")
      .eq("user_id", user.id)
      .eq("movie_slug", movieSlug)
      .maybeSingle();

    const newProgress = {
      ...(existing?.episodes_progress || {}),
      [episodeSlug]: { 
        lastTime, 
        duration, 
        isFinished: isFinishedCurrent, 
        updated_at: new Date().toISOString() 
      },
    };

    // Phim lẻ hoặc tập cuối thì is_finished = true
    const movieIsFinished = isFinishedCurrent && !nextEpisodeSlug;
    // Nếu xem xong tập này mà có tập tiếp theo thì gán tập tiếp theo làm mặc định cho trang chủ
    const targetEpisodeSlug = (isFinishedCurrent && nextEpisodeSlug) ? nextEpisodeSlug : episodeSlug;

    const historyData = {
      user_id: user.id,
      movie_slug: movieSlug,
      movie_name: body.movieName,
      movie_poster: body.moviePoster,
      last_episode_slug: targetEpisodeSlug,
      episodes_progress: newProgress,
      is_finished: movieIsFinished,
      updated_at: new Date().toISOString(), // LUÔN CẬP NHẬT ĐỂ SORT MỚI NHẤT
    };

    // Ghi Redis & Xóa cache danh sách
    if (redis) {
      await redis.set(`user_history:${user.id}:${movieSlug}`, historyData, { ex: 604800 });
      await redis.del(listCacheKey); 
    }

    // Ghi Database (Lọc bỏ phim rác dưới 60s trừ khi đã xong)
    if (movieIsFinished || lastTime > 60 || targetEpisodeSlug !== episodeSlug) {
      await supabase.from("watch_history").upsert(historyData, { onConflict: "user_id, movie_slug" });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Fail" }, { status: 500 });
  }
}