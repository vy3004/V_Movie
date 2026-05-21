"use client";

import dynamic from "next/dynamic";
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import EpisodeSelectorSkeleton from "@/components/shared/EpisodeSelectorSkeleton";
import {
  Movie,
  HistoryItem,
  EpisodeProgress,
  Episode,
  ServerData,
  SubscriptionItem,
} from "@/types";
import { getLocalHistory } from "@/lib/utils";
import { useHistoryTracker } from "@/hooks/useHistory";
import {
  findEpisodeByKey,
  getEpisodeProgressKey,
} from "@/services/movie-sources/utils";
import { useSubscriptionAction } from "@/hooks/useSubscription";

const VideoPlayer = dynamic(() => import("@/components/shared/VideoPlayer"), {
  ssr: false,
  loading: () => (
    <div className="aspect-video bg-zinc-900 animate-pulse rounded-2xl" />
  ),
});
const EpisodeSelector = dynamic(() => import("./WatchEpisodeSelector"), {
  ssr: false,
  loading: () => <EpisodeSelectorSkeleton />,
});
const CommentSection = dynamic(() => import("./CommentSection"), {
  ssr: false,
  loading: () => <div className="h-40 animate-pulse bg-zinc-900 rounded-xl" />,
});

interface Props {
  movie: Movie;
  history?: HistoryItem | null;
  user?: User | null;
}

function hasPlayableLink(episode: ServerData) {
  return Boolean(episode.slug && episode.link_m3u8);
}

function getServerPreferenceKey(movie: Movie) {
  return `v-movie:watch-server:${movie.source || "ophim"}:${movie.slug}`;
}

function normalizeServerName(name: string) {
  return name
    .replace(/^(OP|PA) - /, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function getPlayableServerIndex(
  servers: Episode[],
  preferredServerName?: string | null,
  episodeKey?: string,
) {
  const playableServers = servers
    .map((server, idx) => ({ server, idx }))
    .filter(({ server }) => server.server_data.some(hasPlayableLink))
    .filter(({ server }) =>
      episodeKey ? Boolean(findEpisodeByKey(server, episodeKey)) : true,
    );

  if (!playableServers.length) return 0;

  if (preferredServerName) {
    const normalizedPreferred = normalizeServerName(preferredServerName);
    const requested = playableServers.find(
      ({ server }) =>
        normalizeServerName(server.server_name) === normalizedPreferred,
    );
    if (requested) return requested.idx;
  }

  const ophim = playableServers.find(({ server }) => server.source === "ophim");
  if (ophim) return ophim.idx;

  const vietsub = playableServers.find(({ server }) =>
    normalizeServerName(server.server_name).includes("vietsub"),
  );
  if (vietsub) return vietsub.idx;

  const thuyetMinh = playableServers.find(({ server }) =>
    normalizeServerName(server.server_name).includes("thuyet minh"),
  );
  if (thuyetMinh) return thuyetMinh.idx;

  return playableServers[0].idx;
}

function getDefaultEpisode(server: Episode | undefined) {
  const episodes = server?.server_data.filter(hasPlayableLink) || [];
  return episodes[0] || null;
}

export default function WatchMovie({ movie, history, user }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const sourceParam = searchParams.get("source");
  const initialTap = searchParams.get("tap");
  const [watchMovie, setwatchMovie] = useState(movie);
  const [tap, setTap] = useState(initialTap || "");
  const [historyTap, setHistoryTap] = useState("");

  const { clearBadge } = useSubscriptionAction({ user, movie });

  const [sessionProgress, setSessionProgress] = useState<
    Record<string, EpisodeProgress>
  >({});
  const [isInitializing, setIsInitializing] = useState(true);

  const [activeServerIdx, setActiveServerIdx] = useState(() =>
    getPlayableServerIndex(movie.episodes),
  );

  useEffect(() => {
    const preferredTap = initialTap || historyTap;
    const preferredServerName = localStorage.getItem(
      getServerPreferenceKey(movie),
    );
    const nextServerIdx = getPlayableServerIndex(
      movie.episodes,
      preferredServerName,
      preferredTap || undefined,
    );
    setwatchMovie(movie);
    setActiveServerIdx(nextServerIdx);
    setTap(preferredTap);
  }, [movie, initialTap, historyTap]);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const nextTap = params.get("tap") || "";
      const preferredServerName = localStorage.getItem(
        getServerPreferenceKey(watchMovie),
      );
      setTap(nextTap);
      setActiveServerIdx(
        getPlayableServerIndex(
          watchMovie.episodes,
          preferredServerName,
          nextTap,
        ),
      );
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [watchMovie]);

  useEffect(() => {
    let cancelled = false;

    const enrich = async () => {
      const params = new URLSearchParams({
        slug: movie.slug,
        source: movie.source || "ophim",
      });
      const res = await fetch(`/api/movies/detail/enrich?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      const enrichedEpisodes = data.item?.episodes || [];
      const currentEpisodeCount = movie.episodes.reduce(
        (total, server) => total + server.server_data.length,
        0,
      );
      const enrichedEpisodeCount = enrichedEpisodes.reduce(
        (total: number, server: Episode) => total + server.server_data.length,
        0,
      );
      if (!cancelled && enrichedEpisodeCount > currentEpisodeCount) {
        setwatchMovie(data.item);
      }
    };

    enrich().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [movie]);

  const updateWatchUrl = useCallback(
    (
      nextServerIdx: number,
      nextEpisode: ServerData,
      anchor = false,
      push = false,
    ) => {
      const server = watchMovie.episodes[nextServerIdx];
      const nextTap = getEpisodeProgressKey(nextEpisode) || nextEpisode.slug;
      setActiveServerIdx(nextServerIdx);
      setTap(nextTap);

      if (server?.server_name) {
        localStorage.setItem(
          getServerPreferenceKey(watchMovie),
          server.server_name,
        );
      }

      const params = new URLSearchParams(window.location.search);
      params.set("source", watchMovie.source || sourceParam || "ophim");
      params.delete("server");
      params.set("tap", nextTap);

      const hash = anchor ? "" : window.location.hash;
      const url = `${pathname}?${params.toString()}${hash}`;
      const method = push ? "pushState" : "replaceState";
      window.history[method](null, "", url);
    },
    [pathname, sourceParam, watchMovie],
  );

  const activeEpisode = useMemo(() => {
    if (!tap) return null;

    const activeServer = watchMovie.episodes[activeServerIdx];
    return (
      activeServer?.server_data.find(
        (episode) => String(episode.slug) === String(tap),
      ) ||
      findEpisodeByKey(activeServer, tap) ||
      null
    );
  }, [tap, activeServerIdx, watchMovie.episodes]);

  const canonicalEpisodeKey = useMemo(
    () => getEpisodeProgressKey(activeEpisode) || tap,
    [activeEpisode, tap],
  );

  const activeServerEpisodes = useMemo(
    () =>
      watchMovie.episodes[activeServerIdx]?.server_data.filter(
        hasPlayableLink,
      ) || [],
    [activeServerIdx, watchMovie.episodes],
  );

  const activeEpisodeIdx = useMemo(() => {
    if (!activeEpisode) return -1;
    return activeServerEpisodes.findIndex(
      (episode) => episode.slug === activeEpisode.slug,
    );
  }, [activeEpisode, activeServerEpisodes]);

  const { nextEpisode, prevEpisode } = useMemo(
    () => ({
      nextEpisode:
        activeEpisodeIdx !== -1 &&
        activeEpisodeIdx < activeServerEpisodes.length - 1
          ? activeServerEpisodes[activeEpisodeIdx + 1]
          : null,
      prevEpisode:
        activeEpisodeIdx > 0
          ? activeServerEpisodes[activeEpisodeIdx - 1]
          : null,
    }),
    [activeEpisodeIdx, activeServerEpisodes],
  );

  useEffect(() => {
    if (tap) return;

    const preferredTap = initialTap || historyTap;
    const preferredServerName = localStorage.getItem(
      getServerPreferenceKey(watchMovie),
    );
    const nextServerIdx = getPlayableServerIndex(
      watchMovie.episodes,
      preferredServerName,
      preferredTap || undefined,
    );
    const nextServer = watchMovie.episodes[nextServerIdx];
    const queryEpisode = preferredTap
      ? findEpisodeByKey(nextServer, preferredTap)
      : undefined;
    const defaultEpisode = queryEpisode || getDefaultEpisode(nextServer);

    if (!defaultEpisode) return;
    updateWatchUrl(nextServerIdx, defaultEpisode);
  }, [historyTap, initialTap, tap, updateWatchUrl, watchMovie]);

  // 1. Logic Xử lý đồng bộ tiến độ xem phim (Sync Watch Progress)
  const { handleTimeUpdate, syncToSupabase, getCurrentEpisodeProgress } =
    useHistoryTracker({
      user,
      movie,
      episodeSlug: canonicalEpisodeKey,
    });

  const syncProgress = useCallback(() => {
    syncToSupabase();
    const progress = getCurrentEpisodeProgress();
    if (!progress || !canonicalEpisodeKey) return;

    setSessionProgress((current) => ({
      ...current,
      [canonicalEpisodeKey]: {
        ...progress,
        ep_is_finished:
          current[canonicalEpisodeKey]?.ep_is_finished ||
          progress.ep_is_finished,
      },
    }));
  }, [canonicalEpisodeKey, getCurrentEpisodeProgress, syncToSupabase]);

  // 2. Logic Xử lý Xóa nhãn "Tập mới" (Clear Badge)
  useEffect(() => {
    // Kiểm tra cache xem có badge không để xóa
    const subsList = queryClient.getQueryData<SubscriptionItem[]>([
      "subscriptions-list",
      user?.id || "guest",
    ]);

    const currentSub = subsList?.find((s) => s.movie_slug === movie.slug);
    const hasNew =
      currentSub?.has_new_episode === true ||
      String(currentSub?.has_new_episode) === "true";

    if (hasNew) {
      clearBadge(); // Gọi hàm từ hook đã tích hợp
    }
  }, [movie.slug, user, clearBadge, queryClient]);

  useEffect(() => {
    const loadInitialHistory = () => {
      let initialProgress = history?.episodes_progress || {};
      let latestTap = history?.last_episode_slug || "";
      if (!user && !history) {
        const localData = getLocalHistory().find(
          (h) => h.movie_slug === movie.slug,
        );
        if (localData?.episodes_progress)
          initialProgress = localData.episodes_progress;
        latestTap = localData?.last_episode_slug || "";
      }
      setSessionProgress(initialProgress);
      setHistoryTap(latestTap);
      setIsInitializing(false);
    };
    loadInitialHistory();
  }, [history, movie.slug, user]);

  // Tính toán thời gian resume (tiếp tục xem)
  const resumeTime = useMemo(() => {
    if (!canonicalEpisodeKey || isInitializing) return 0;
    const epData = sessionProgress[canonicalEpisodeKey];
    if (!epData) return 0;
    if (
      epData.ep_duration > 0 &&
      epData.ep_last_time / epData.ep_duration > 0.98
    )
      return 0;
    return epData.ep_is_finished ? 0 : Number(epData.ep_last_time || 0);
  }, [canonicalEpisodeKey, sessionProgress, isInitializing]);

  // Chốt dữ liệu tập cũ trước khi chuyển tập
  const handleSelectEpisode = useCallback(
    (sv: ServerData) => {
      syncProgress();
      const activeServer = watchMovie.episodes[activeServerIdx];
      const selectedEpisode =
        findEpisodeByKey(activeServer, getEpisodeProgressKey(sv)) || sv;
      updateWatchUrl(activeServerIdx, selectedEpisode, true, true);
    },
    [activeServerIdx, syncProgress, updateWatchUrl, watchMovie.episodes],
  );

  const handlePrevEpisode = useCallback(() => {
    syncProgress();
    if (prevEpisode) updateWatchUrl(activeServerIdx, prevEpisode, true, true);
  }, [activeServerIdx, syncProgress, prevEpisode, updateWatchUrl]);

  const handleNextEpisode = useCallback(() => {
    syncProgress();
    if (nextEpisode) updateWatchUrl(activeServerIdx, nextEpisode, true, true);
  }, [activeServerIdx, syncProgress, nextEpisode, updateWatchUrl]);

  const handleAutoNext = useCallback(() => {
    handleNextEpisode();
  }, [handleNextEpisode]);

  if (isInitializing || !tap)
    return (
      <div className="h-[60vh] flex items-center justify-center text-zinc-500">
        Đang tải...
      </div>
    );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div id="video" className="scroll-mt-24">
        {activeEpisode ? (
          <>
            <h2 className="text-lg font-bold text-white mb-3 truncate">
              {`${watchMovie.name} - ${activeEpisode.name}`}
            </h2>
            <VideoPlayer
              key={`${watchMovie.slug}-${activeServerIdx}-${tap}`}
              user={user}
              movie={watchMovie}
              movieSrc={activeEpisode.link_m3u8}
              nextEpisodeSlug={nextEpisode?.slug || null}
              prevEpisodeSlug={prevEpisode?.slug || null}
              initialTime={resumeTime}
              onProgress={handleTimeUpdate}
              onAutoNext={handleAutoNext}
              onPrevEpisode={handlePrevEpisode}
              onNextEpisode={handleNextEpisode}
            />
          </>
        ) : (
          <div className="aspect-video bg-zinc-900 rounded-2xl flex items-center justify-center text-zinc-500">
            Không tìm thấy tập phim
          </div>
        )}
      </div>

      {watchMovie.episodes.length > 0 && (
        <EpisodeSelector
          servers={watchMovie.episodes}
          selectedEpisodeKey={canonicalEpisodeKey}
          onSelect={handleSelectEpisode}
          episodesProgress={sessionProgress}
          activeServerIdx={activeServerIdx}
          onServerChange={(idx) => {
            syncProgress();
            const nextServer = watchMovie.episodes[idx];
            const sameEpisode = findEpisodeByKey(
              nextServer,
              canonicalEpisodeKey,
            );
            const defaultEpisode = sameEpisode || getDefaultEpisode(nextServer);
            if (!defaultEpisode) return;
            updateWatchUrl(idx, defaultEpisode, false, true);
          }}
        />
      )}

      <CommentSection movieSlug={movie.slug} movieName={movie.name} />
    </div>
  );
}
