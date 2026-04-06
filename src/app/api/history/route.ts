import { redis } from "@/lib/redis";
import { createSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Khuyến nghị: Dùng MessagePack (msgpackr) để nén value trước khi lưu Redis
// thay vì JSON thô, giúp tiết kiệm RAM ~40-60%. Cần: npm install msgpackr

const EPISODE_PROGRESS_TTL = 604800; // 7 ngày (giây)
const CONTINUE_WATCHING_MAX = 50;    // Giữ tối đa 50 phim trong sorted set

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      movieSlug,
      episodeSlug,
      lastTime,
      duration,
      nextEpisodeSlug,
      isSync,
      localHistory,
      shouldWriteDb,
    } = body;

    const supabase = await createSupabaseServer();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const listCacheKey = `history_list:${user.id}`;
    const epProgressKey = `ep_progress:${user.id}:${movieSlug}`;
    const continueWatchingKey = `continue_watching:${user.id}`;

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
      await supabase
        .from("watch_history")
        .upsert(syncData, { onConflict: "user_id, movie_slug" });
      if (redis) await redis.del(listCacheKey);
      return NextResponse.json({ success: true });
    }

    // 2. LỌC BỎ PHIM RÁC: Dưới 60 giây và chưa xem xong → không lưu gì cả
    const isFinishedCurrent =
      duration > 0 && lastTime / duration > 0.9;

    if (lastTime < 60 && !isFinishedCurrent) {
      return NextResponse.json({ success: true, skipped: true });
    }

    // 3. CẬP NHẬT REDIS HASH (lưu tiến trình từng tập)
    // Hash key: ep_progress:{userId}:{movieSlug}
    // Hash field: {episodeSlug}
    // Hash value: JSON object {lastTime, duration, isFinished, updated_at}
    if (redis) {
      const epValue = JSON.stringify({
        lastTime,
        duration,
        isFinished: isFinishedCurrent,
        updated_at: new Date().toISOString(),
      });
      await redis.hset(epProgressKey, { [episodeSlug]: epValue });
      await redis.expire(epProgressKey, EPISODE_PROGRESS_TTL);

      // 4. CẬP NHẬT SORTED SET "Continue Watching"
      // Score = timestamp để sắp xếp theo thời gian xem gần nhất
      if (isFinishedCurrent) {
        // Xem xong (>90%): xóa khỏi "Xem tiếp", giữ trong lịch sử
        await redis.zrem(continueWatchingKey, movieSlug);
      } else {
        // Đang xem dở: thêm/cập nhật vào sorted set
        await redis.zadd(continueWatchingKey, {
          score: Date.now(),
          member: movieSlug,
        });
        // Chỉ giữ CONTINUE_WATCHING_MAX phim gần nhất, xóa cũ
        await redis.zremrangebyrank(continueWatchingKey, 0, -(CONTINUE_WATCHING_MAX + 1));
      }
    }

    // 5. GHI DATABASE: Chỉ khi shouldWriteDb=true hoặc phim đã xong
    const movieIsFinished = isFinishedCurrent && !nextEpisodeSlug;
    const targetEpisodeSlug =
      isFinishedCurrent && nextEpisodeSlug ? nextEpisodeSlug : episodeSlug;

    if (shouldWriteDb || movieIsFinished) {
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
          updated_at: new Date().toISOString(),
        },
      };

      const historyData = {
        user_id: user.id,
        movie_slug: movieSlug,
        movie_name: body.movieName,
        movie_poster: body.moviePoster,
        last_episode_slug: targetEpisodeSlug,
        episodes_progress: newProgress,
        is_finished: movieIsFinished,
        updated_at: new Date().toISOString(),
      };

      await supabase
        .from("watch_history")
        .upsert(historyData, { onConflict: "user_id, movie_slug" });

      if (redis) await redis.del(listCacheKey);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Fail" }, { status: 500 });
  }
}