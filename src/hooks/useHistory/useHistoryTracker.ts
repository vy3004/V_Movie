"use client";

import { useRef, useEffect, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { User } from "@supabase/supabase-js";
import { throttle } from "lodash-es";
import { getDeviceId, getLocalHistory, saveLocalHistory } from "@/lib/utils";
import {
  HistoryUpdatePayload,
  Movie,
  HistoryItem,
  EpisodeProgress,
} from "@/types";

export function useHistoryTracker({
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

  const queryClient = useQueryClient();

  // KHAI BÁO Ổ KHÓA ĐỂ CHỐNG GỌI TRÙNG LẶP API
  const lastSavedDBStateRef = useRef<{ slug: string; time: number } | null>(
    null,
  );

  // 1. Tính tập cuối của phim
  const lastEpOfMovie =
    movie.episodes.flatMap((e) => e.server_data).pop()?.slug || "";

  // Bóc tách Metadata
  const movieMetadataRef = useRef({
    genres: movie.category?.map((c) => c.name) || [],
    directors: movie.director || [],
    actors: movie.actor || [],
    country: movie.country?.map((c) => c.name) || [],
  });

  useEffect(() => {
    movieMetadataRef.current = {
      genres: movie.category?.map((c) => c.name) || [],
      directors: movie.director || [],
      actors: movie.actor || [],
      country: movie.country?.map((c) => c.name) || [],
    };
  }, [movie]);

  useEffect(() => {
    inMemoryLocalHistory.current = getLocalHistory();
  }, []);

  // 2. Logic lưu LocalStorage an toàn (Chống spam bằng Throttle 5s)
  const syncLocal = useMemo(
    () =>
      throttle(() => {
        const data = trackingData.current;
        if (!data || data.current_time < 5) return;

        const existing = inMemoryLocalHistory.current.find(
          (h) => h.movie_slug === movie.slug,
        );
        const existingProgress =
          (existing?.episodes_progress as Record<string, EpisodeProgress>) ||
          {};

        const isCurrentEpFinished =
          data.duration > 0 && data.current_time / data.duration > 0.9;
        const finalEpIsFinished =
          existingProgress[episodeSlug]?.ep_is_finished || isCurrentEpFinished;

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
          movie_metadata: movieMetadataRef.current,
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
    [movie.slug, movie.name, movie.poster_url, episodeSlug, lastEpOfMovie],
  );

  useEffect(() => {
    return () => {
      syncLocal.cancel();
    };
  }, [syncLocal]);

  // 3. Logic Gửi Tracking Lên Redis
  const handleTimeUpdate = useCallback(
    (currentTime: number, duration: number) => {
      trackingData.current = {
        movie_slug: movie.slug,
        last_episode_slug: episodeSlug,
        last_episode_of_movie_slug: lastEpOfMovie,
        current_time: currentTime,
        duration,
      };

      syncLocal();

      const currentSecond = Math.floor(currentTime);

      if (
        currentSecond >= 30 &&
        currentSecond % 30 === 0 &&
        currentSecond !== lastSyncedTimeRef.current
      ) {
        lastSyncedTimeRef.current = currentSecond;

        const payload = {
          ...trackingData.current,
          user_id: user?.id,
          device_id: user ? undefined : getDeviceId(),
          movie_name: movie.name,
          movie_poster: movie.poster_url,
          movie_metadata: movieMetadataRef.current,
        };

        fetch("/api/history/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(console.error);
      }
    },
    [movie, episodeSlug, lastEpOfMovie, syncLocal, user],
  );

  // 4. Chốt DB khi thoát (Dùng Blob để chống lỗi rớt Header)
  const syncSupabase = useCallback(() => {
    syncLocal.flush();
    if (!user) {
      // Nếu là Guest, ép cập nhật ngay lúc này
      queryClient.invalidateQueries({ queryKey: ["history-list"] });
      queryClient.invalidateQueries({ queryKey: ["history-stats"] });
      return;
    }

    const data = trackingData.current;
    if (!data || data.current_time < 30) return;

    // Khi chuyển tập, tập mới chưa play nhưng lại lấy data.current_time của tập cũ để lưu
    if (data.last_episode_slug !== episodeSlug) return;

    // Nếu tập phim và thời gian không hề thay đổi so với lần gọi ngay trước đó -> Block
    if (
      lastSavedDBStateRef.current?.slug === episodeSlug &&
      lastSavedDBStateRef.current?.time === data.current_time
    ) {
      return;
    }

    // Khóa lại trạng thái hiện tại
    lastSavedDBStateRef.current = {
      slug: episodeSlug,
      time: data.current_time,
    };

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
      movie_metadata: movieMetadataRef.current,
      episodes_progress: {
        [episodeSlug]: {
          ep_last_time: data.current_time,
          ep_duration: data.duration,
          ep_is_finished: finalEpIsFinished,
          ep_updated_at: new Date().toISOString(),
        },
      },
    };

    const blobPayload = new Blob([JSON.stringify(historyItem)], {
      type: "application/json",
    });

    fetch("/api/history", {
      method: "POST",
      body: blobPayload,
      keepalive: true,
    })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["history-list"] });
        queryClient.invalidateQueries({ queryKey: ["history-stats"] });
      })
      .catch(console.error);
  }, [user, movie, episodeSlug, lastEpOfMovie, syncLocal, queryClient]);

  // Gắn event cho việc đóng tab / chuyển trang
  useEffect(() => {
    window.addEventListener("beforeunload", syncSupabase);
    window.addEventListener("pagehide", syncSupabase);

    return () => {
      window.removeEventListener("beforeunload", syncSupabase);
      window.removeEventListener("pagehide", syncSupabase);
      syncSupabase(); // Đảm bảo lưu lần cuối khi component unmount
    };
  }, [syncSupabase]);

  return { handleTimeUpdate, syncToSupabase: syncSupabase };
}
