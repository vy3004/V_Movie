"use client";

import { useRef, useEffect, useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { getDeviceId, getLocalHistory, saveLocalHistory } from "@/lib/utils";
import {
  HistoryUpdatePayload,
  Movie,
  HistoryItem,
  EpisodeProgress,
} from "@/lib/types";

interface UseWatchHistoryProps {
  user: User | null | undefined;
  movie: Movie;
  episodeSlug: string;
}

const REDIS_SYNC_INTERVAL = 30000; // 30 giây

export function useWatchHistory({
  user,
  movie,
  episodeSlug,
}: UseWatchHistoryProps) {
  const trackingData = useRef<HistoryUpdatePayload | null>(null);

  // Refs tránh stale closure trong event listeners
  const episodeSlugRef = useRef(episodeSlug);
  episodeSlugRef.current = episodeSlug;
  const userRef = useRef(user);
  userRef.current = user;
  const movieRef = useRef(movie);
  movieRef.current = movie;

  const getLastEpisodeSlug = useCallback(() => {
    const allEpisodes = movieRef.current.episodes.flatMap(
      (ep) => ep.server_data,
    );
    return allEpisodes[allEpisodes.length - 1]?.slug;
  }, []);

  /**
   * CORE LOGIC: Lưu vào LocalStorage
   * Được gọi bởi cả Guest và User để UI (Trang chủ, Navbar) cập nhật tức thì
   */
  const syncToLocalStorage = useCallback(() => {
    const payload = trackingData.current;
    if (!payload || payload.current_time < 5) return;

    const isFinished =
      payload.duration > 0 && payload.current_time / payload.duration > 0.9;
    const lastEpOfMovie = getLastEpisodeSlug();

    // 1. Lấy dữ liệu cũ để merge
    const localHistory = getLocalHistory();
    const existingMovie = localHistory.find(
      (h) => h.movie_slug === movieRef.current.slug,
    );
    const existingProgress =
      (existingMovie?.episodes_progress as Record<string, EpisodeProgress>) ||
      {};

    // 2. Logic vĩnh viễn: Nếu tập này ĐÃ TỪNG xong, giữ là true
    const isEpFinished =
      existingProgress[episodeSlugRef.current]?.ep_is_finished || isFinished;

    const mergedProgress = {
      ...existingProgress,
      [episodeSlugRef.current]: {
        ep_last_time: payload.current_time,
        ep_duration: payload.duration,
        ep_is_finished: isEpFinished,
        ep_updated_at: new Date().toISOString(),
      },
    };

    // 3. Tạo object history item hoàn chỉnh
    const historyItem: HistoryItem = {
      movie_slug: movieRef.current.slug,
      movie_name: movieRef.current.name,
      movie_poster: movieRef.current.poster_url,
      last_episode_slug: episodeSlugRef.current,
      last_episode_of_movie_slug: lastEpOfMovie,
      episodes_progress: mergedProgress,
      // Phim hoàn thành khi và chỉ khi tập cuối cùng đã hoàn thành
      is_finished: lastEpOfMovie
        ? mergedProgress[lastEpOfMovie]?.ep_is_finished === true
        : false,
      updated_at: new Date().toISOString(),
    };

    saveLocalHistory(historyItem);
  }, [getLastEpisodeSlug]);

  /**
   * Sync lên Supabase (Chốt chặn cuối cùng cho User)
   */
  const syncToSupabase = useCallback(() => {
    // Luôn ưu tiên lưu Local trước để UI không bị delay
    syncToLocalStorage();

    if (!userRef.current) return; // Guest dừng ở đây

    const payload = trackingData.current;
    if (!payload || payload.current_time < 10) return;

    const isFinished =
      payload.duration > 0 && payload.current_time / payload.duration > 0.9;
    const lastEpOfMovie = getLastEpisodeSlug();

    const historyItem = {
      movie_slug: movieRef.current.slug,
      movie_name: movieRef.current.name,
      movie_poster: movieRef.current.poster_url,
      last_episode_slug: episodeSlugRef.current,
      last_episode_of_movie_slug: lastEpOfMovie,
      episodes_progress: {
        [episodeSlugRef.current]: {
          ep_last_time: payload.current_time,
          ep_duration: payload.duration,
          ep_is_finished: isFinished,
          ep_updated_at: new Date().toISOString(),
        },
      },
      is_finished: isFinished,
      device_id: getDeviceId(),
    };

    navigator.sendBeacon(
      "/api/history",
      new Blob([JSON.stringify(historyItem)], { type: "application/json" }),
    );
    window.dispatchEvent(new Event("local-history-updated"));
  }, [getLastEpisodeSlug, syncToLocalStorage]);

  /**
   * Sync lên Redis (Lưu đệm định kỳ 30s)
   */
  const syncToRedis = useCallback(() => {
    const payload = trackingData.current;
    if (!payload || payload.current_time < REDIS_SYNC_INTERVAL) return;

    const finalPayload = {
      ...payload,
      user_id: userRef.current?.id,
      device_id: userRef.current ? undefined : getDeviceId(),
      movie_name: movieRef.current.name,
      movie_poster: movieRef.current.poster_url,
      last_episode_slug: episodeSlugRef.current,
      last_episode_of_movie_slug: getLastEpisodeSlug(),
    };

    navigator.sendBeacon(
      "/api/history/track",
      new Blob([JSON.stringify(finalPayload)], { type: "application/json" }),
    );

    // Đã gọi syncToRedis thì tiện tay sync luôn LocalStorage (0% hại hiệu năng)
    syncToLocalStorage();
  }, [getLastEpisodeSlug, syncToLocalStorage]);

  const handleTimeUpdate = useCallback(
    (currentTime: number, duration: number) => {
      trackingData.current = {
        movie_slug: movieRef.current?.slug || "",
        last_episode_slug: episodeSlugRef.current,
        last_episode_of_movie_slug: getLastEpisodeSlug(),
        current_time: currentTime,
        duration: duration,
      };
    },
    [getLastEpisodeSlug],
  );

  // Interval sync Redis + Local
  useEffect(() => {
    const interval = setInterval(syncToRedis, REDIS_SYNC_INTERVAL);
    return () => clearInterval(interval);
  }, [syncToRedis]);

  // Sync Supabase khi đóng tab/chuyển trang/chuyển tập
  useEffect(() => {
    const handleExit = () => syncToSupabase();
    window.addEventListener("beforeunload", handleExit);
    window.addEventListener("pagehide", handleExit);
    return () => {
      window.removeEventListener("beforeunload", handleExit);
      window.removeEventListener("pagehide", handleExit);
      handleExit();
    };
  }, [syncToSupabase]);

  return { handleTimeUpdate, syncToSupabase };
}
