"use client";

import { useRef, useEffect, useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { getDeviceId } from "@/lib/utils";
import { HistoryUpdatePayload, Movie } from "@/lib/types";

interface UseWatchHistoryProps {
  user: User | null | undefined;
  movie: Movie;
  episodeSlug: string;
}

const REDIS_SYNC_INTERVAL = 30000;

export function useWatchHistory({ user, movie, episodeSlug }: UseWatchHistoryProps) {
  const trackingData = useRef<HistoryUpdatePayload | null>(null);
  
  // Refs tránh stale closure
  const episodeSlugRef = useRef(episodeSlug);
  episodeSlugRef.current = episodeSlug;
  const userRef = useRef(user);
  userRef.current = user;
  const movieRef = useRef(movie);
  movieRef.current = movie;

  const getLastEpisodeSlug = useCallback(() => {
    const allEpisodes = movieRef.current.episodes.flatMap((ep) => ep.server_data);
    return allEpisodes[allEpisodes.length - 1]?.slug;
  }, []);

  // 1. Hàm Sync lên Supabase (Chỉ gọi khi chốt tập/thoát trang)
  const syncToSupabase = useCallback(() => {
    const payload = trackingData.current;
    if (!payload || payload.current_time < 10) return;

    const isFinished = payload.duration > 0 && payload.current_time / payload.duration > 0.9;
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
      is_finished: isFinished, // API sẽ merge logic vĩnh viễn
      device_id: getDeviceId()
    };

    // Dùng sendBeacon để đảm bảo gửi thành công khi thoát trang
    navigator.sendBeacon("/api/history", new Blob([JSON.stringify(historyItem)], { type: "application/json" }));
    window.dispatchEvent(new Event("local-history-updated"));
  }, [getLastEpisodeSlug]);

  // 2. Hàm Sync lên Redis (Định kỳ 30s)
  const syncToRedis = useCallback(() => {
    const payload = trackingData.current;
    if (!payload || payload.current_time < 30) return;

    const finalPayload = {
      ...payload,
      user_id: userRef.current?.id,
      device_id: userRef.current ? undefined : getDeviceId(),
      movie_name: movieRef.current.name,
      movie_poster: movieRef.current.poster_url,
      last_episode_slug: episodeSlugRef.current,
      last_episode_of_movie_slug: getLastEpisodeSlug(),
    };

    navigator.sendBeacon("/api/history/track", new Blob([JSON.stringify(finalPayload)], { type: "application/json" }));
  }, [getLastEpisodeSlug]);

  // Handle Time Update từ Player (Chỉ lưu vào Ref, không tốn tài nguyên)
  const handleTimeUpdate = useCallback((currentTime: number, duration: number) => {
    trackingData.current = {
      movie_slug: movieRef.current?.slug || "",
      last_episode_slug: episodeSlugRef.current,
      last_episode_of_movie_slug: getLastEpisodeSlug(),
      current_time: currentTime,
      duration: duration,
    };
  }, [getLastEpisodeSlug]);

  // Loop lưu Redis mỗi 30s
  useEffect(() => {
    const interval = setInterval(syncToRedis, REDIS_SYNC_INTERVAL);
    return () => clearInterval(interval);
  }, [syncToRedis]);

  // Lắng nghe đóng tab/chuyển trang để chốt Supabase
  useEffect(() => {
    const handleExit = () => syncToSupabase();
    window.addEventListener("beforeunload", handleExit);
    window.addEventListener("pagehide", handleExit);
    return () => {
      window.removeEventListener("beforeunload", handleExit);
      window.removeEventListener("pagehide", handleExit);
      handleExit(); // Chốt khi unmount (chuyển tập)
    };
  }, [syncToSupabase]);

  return { handleTimeUpdate, syncToSupabase };
}