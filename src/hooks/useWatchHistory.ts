"use client";

import { useRef, useEffect, useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { throttle } from "lodash-es";
import { getDeviceId, getLocalHistory, saveLocalHistory } from "@/lib/utils";
import {
  HistoryUpdatePayload,
  Movie,
  HistoryItem,
  EpisodeProgress,
} from "@/types";

export function useWatchHistory({
  user,
  movie,
  episodeSlug,
}: {
  user: User | null | undefined;
  movie: Movie;
  episodeSlug: string;
}) {
  const trackingData = useRef<HistoryUpdatePayload | null>(null);
  const inMemoryLocalHistory = useRef<HistoryItem[]>([]);
  const lastSyncedTimeRef = useRef<number>(-1);

  // 1. Tính tập cuối của phim
  const lastEpOfMovie =
    movie.episodes.flatMap((e) => e.server_data).pop()?.slug || "";

  useEffect(() => {
    inMemoryLocalHistory.current = getLocalHistory();
  }, []);

  // 2. Logic lưu LocalStorage an toàn
  const syncLocal = useCallback(
    throttle(() => {
      const data = trackingData.current;
      if (!data || data.current_time < 5) return;

      const existing = inMemoryLocalHistory.current.find(
        (h) => h.movie_slug === movie.slug,
      );
      const existingProgress =
        (existing?.episodes_progress as Record<string, EpisodeProgress>) || {};

      // Xác định trạng thái xem xong của tập hiện tại
      const isCurrentEpFinished =
        data.duration > 0 && data.current_time / data.duration > 0.9;
      // Lấy trạng thái cũ HOẶC trạng thái mới tính toán
      const finalEpIsFinished =
        existingProgress[episodeSlug]?.ep_is_finished || isCurrentEpFinished;

      // Xác định trạng thái xem xong của CẢ BỘ PHIM
      // Nếu tập đang xem là tập cuối -> Lấy trạng thái của nó
      // Nếu không, lấy trạng thái cũ của tập cuối (nếu có)
      const isMovieCompletelyFinished =
        episodeSlug === lastEpOfMovie
          ? finalEpIsFinished
          : existingProgress[lastEpOfMovie]?.ep_is_finished || false;

      const newItem: HistoryItem = {
        movie_slug: movie.slug,
        movie_name: movie.name,
        movie_poster: movie.poster_url,
        last_episode_slug: episodeSlug,
        last_episode_of_movie_slug: lastEpOfMovie,
        updated_at: new Date().toISOString(),
        is_finished: isMovieCompletelyFinished,
        episodes_progress: {
          ...existingProgress,
          [episodeSlug]: {
            ep_last_time: data.current_time,
            ep_duration: data.duration,
            ep_is_finished: finalEpIsFinished,
            ep_updated_at: new Date().toISOString(),
          },
        },
      };

      const index = inMemoryLocalHistory.current.findIndex(
        (h) => h.movie_slug === movie.slug,
      );
      if (index > -1) inMemoryLocalHistory.current[index] = newItem;
      else inMemoryLocalHistory.current.push(newItem);

      saveLocalHistory(newItem);
    }, 5000),
    [movie, episodeSlug, lastEpOfMovie],
  );

  // 3. Gửi tracking lên Redis
  const syncRedis = useCallback(() => {
    const data = trackingData.current;
    if (
      !data ||
      data.current_time < 30 ||
      data.current_time === lastSyncedTimeRef.current
    )
      return;

    lastSyncedTimeRef.current = data.current_time;

    const payload = {
      ...data,
      user_id: user?.id,
      device_id: user ? undefined : getDeviceId(),
      movie_name: movie.name,
      movie_poster: movie.poster_url,
      last_episode_slug: episodeSlug,
      last_episode_of_movie_slug: lastEpOfMovie,
    };

    navigator.sendBeacon("/api/history/track", JSON.stringify(payload));
  }, [user, movie, episodeSlug, lastEpOfMovie]);

  // 4. Chốt DB khi thoát
  const syncSupabase = useCallback(() => {
    syncLocal();
    if (!user) return;

    const data = trackingData.current;
    if (!data || data.current_time < 30) return; // Nếu chưa được 30s thì khỏi gửi DB

    // Để đảm bảo DB update đúng trạng thái is_finished, ta lấy từ in-memory ra
    const existing = inMemoryLocalHistory.current.find(
      (h) => h.movie_slug === movie.slug,
    );
    const finalEpIsFinished =
      existing?.episodes_progress[episodeSlug]?.ep_is_finished ||
      (data.duration > 0 && data.current_time / data.duration > 0.9);

    const historyItem = {
      movie_slug: movie.slug,
      movie_name: movie.name,
      movie_poster: movie.poster_url,
      last_episode_slug: episodeSlug,
      last_episode_of_movie_slug: lastEpOfMovie,
      episodes_progress: {
        [episodeSlug]: {
          ep_last_time: data.current_time,
          ep_duration: data.duration,
          ep_is_finished: finalEpIsFinished,
          ep_updated_at: new Date().toISOString(),
        },
      },
    };

    navigator.sendBeacon("/api/history", JSON.stringify(historyItem));
  }, [user, movie, episodeSlug, lastEpOfMovie, syncLocal]);

  const handleTimeUpdate = (currentTime: number, duration: number) => {
    trackingData.current = {
      movie_slug: movie.slug,
      last_episode_slug: episodeSlug,
      last_episode_of_movie_slug: lastEpOfMovie,
      current_time: currentTime,
      duration,
    };
    syncLocal();
  };

  useEffect(() => {
    const interval = setInterval(syncRedis, 30000);
    window.addEventListener("beforeunload", syncSupabase);
    window.addEventListener("pagehide", syncSupabase);
    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", syncSupabase);
      window.removeEventListener("pagehide", syncSupabase);
      syncSupabase(); // Đảm bảo lưu lần cuối khi component unmount
    };
  }, [syncRedis, syncSupabase]);

  return { handleTimeUpdate, syncToSupabase: syncSupabase };
}
