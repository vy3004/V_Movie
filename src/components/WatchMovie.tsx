"use client";

import dynamic from "next/dynamic";
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { User } from "@supabase/supabase-js";
import EpisodeSelector from "@/components/EpisodeSelector";
import {
  Movie,
  HistoryItem,
  EpisodeProgress,
  Episode,
  ServerData,
} from "@/lib/types";
import { getLocalHistory } from "@/lib/utils";
import { useWatchHistory } from "@/hooks/useWatchHistory";

const VideoPlayer = dynamic(() => import("@/components/VideoPlayer"), {
  ssr: false,
  loading: () => (
    <div className="aspect-video bg-zinc-900 animate-pulse rounded-2xl" />
  ),
});

interface Props {
  movie: Movie;
  history?: HistoryItem | null;
  user?: User | null;
}

export default function WatchMovie({ movie, history, user }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tap = searchParams.get("tap");

  const [sessionProgress, setSessionProgress] = useState<
    Record<string, EpisodeProgress>
  >({});
  const [isInitializing, setIsInitializing] = useState(true);

  const allEpisodes = useMemo(
    () => movie.episodes.flatMap((ep: Episode) => ep.server_data),
    [movie.episodes],
  );

  // Sử dụng hook đã tối ưu
  const { handleTimeUpdate, syncToSupabase } = useWatchHistory({
    user,
    movie,
    episodeSlug: tap || "",
  });

  const { nextEpSlug, prevEpSlug } = useMemo(() => {
    const idx = allEpisodes.findIndex((s) => String(s.slug) === String(tap));
    return {
      nextEpSlug:
        idx !== -1 && idx < allEpisodes.length - 1
          ? allEpisodes[idx + 1].slug
          : null,
      prevEpSlug: idx > 0 ? allEpisodes[idx - 1].slug : null,
    };
  }, [tap, allEpisodes]);

  useEffect(() => {
    const loadInitialHistory = () => {
      let initialProgress = history?.episodes_progress || {};
      if (!user && !history) {
        const localData = getLocalHistory().find(
          (h) => h.movie_slug === movie.slug,
        );
        if (localData?.episodes_progress)
          initialProgress = localData.episodes_progress;
      }
      setSessionProgress(initialProgress);
      setIsInitializing(false);

      if (!tap && allEpisodes.length > 0) {
        const localHist = getLocalHistory().find(
          (h) => h.movie_slug === movie.slug,
        );
        const targetEp = user
          ? history?.last_episode_slug
          : localHist?.last_episode_slug;
        const finalTap = targetEp || allEpisodes[0]?.slug;
        router.replace(`?tap=${finalTap}`, { scroll: false });
      }
    };
    loadInitialHistory();
  }, [history, movie.slug, user, tap, allEpisodes, router]);

  const resumeTime = useMemo(() => {
    if (!tap || isInitializing) return 0;
    const epData = sessionProgress[tap];
    if (!epData) return 0;
    if (
      epData.ep_duration > 0 &&
      epData.ep_last_time / epData.ep_duration > 0.98
    )
      return 0;
    return epData.ep_is_finished ? 0 : Number(epData.ep_last_time || 0);
  }, [tap, sessionProgress, isInitializing]);

  // Chốt dữ liệu tập cũ trước khi chuyển tập
  const handleSelectEpisode = useCallback(
    (sv: ServerData) => {
      syncToSupabase();
      router.push(`?tap=${sv.slug}#video`, { scroll: false });
    },
    [syncToSupabase, router],
  );

  const handleAutoNext = useCallback(() => {
    syncToSupabase();
    if (nextEpSlug) router.push(`?tap=${nextEpSlug}#video`, { scroll: false });
  }, [syncToSupabase, nextEpSlug, router]);

  if (isInitializing || !tap)
    return (
      <div className="h-[60vh] flex items-center justify-center text-zinc-500">
        Đang tải...
      </div>
    );

  const activeEpisode = allEpisodes.find((e) => String(e.slug) === String(tap));

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div id="video" className="scroll-mt-24">
        {activeEpisode && (
          <VideoPlayer
            key={`${movie.slug}-${tap}`} // Quan trọng để re-mount khi đổi tập
            movieSrc={activeEpisode.link_m3u8}
            movieName={`${movie.name} - Tập ${activeEpisode.name}`}
            nextEpisodeSlug={nextEpSlug}
            prevEpisodeSlug={prevEpSlug}
            initialTime={resumeTime}
            onProgress={handleTimeUpdate}
            onAutoNext={handleAutoNext}
          />
        )}
      </div>
      <div className="bg-background p-6 rounded-xl border border-zinc-800">
        <h3 className="text-lg font-bold text-white mb-4 uppercase tracking-wider">
          Danh sách tập
        </h3>
        <EpisodeSelector
          servers={movie.episodes}
          episodeSelected={tap}
          onSelect={handleSelectEpisode}
          episodesProgress={sessionProgress}
        />
      </div>
    </div>
  );
}
