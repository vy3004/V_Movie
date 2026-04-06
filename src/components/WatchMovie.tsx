"use client";

import dynamic from "next/dynamic";
import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { Movie, HistoryItem, EpisodeProgress } from "@/lib/types";
import { saveLocalHistory, getLocalHistory } from "@/lib/utils";
import EpisodeList from "@/components/EpisodeList";

const VideoPlayer = dynamic(() => import("@/components/VideoPlayer"), {
  ssr: false,
  loading: () => (
    <div className="aspect-video bg-zinc-900 animate-pulse rounded-2xl" />
  ),
});

interface Props {
  movie: Movie;
  history: HistoryItem | null;
  user: User | null;
}

const CONSTANTS = {
  SAVE_INTERVAL_SEC: 15, // Cứ 15s lưu 1 lần để tối ưu API/LocalStorage
  COMPLETED_THRESHOLD: 0.95, // Xem 95% coi như xong tập
};

export default function WatchMovie({ movie, history, user }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tap = searchParams.get("tap");

  const [sessionProgress, setSessionProgress] = useState<
    Record<string, EpisodeProgress>
  >({});
  const [isInitializing, setIsInitializing] = useState(true);

  const playbackRef = useRef({
    currentTime: 0,
    duration: 0,
    lastSavedTime: 0,
  });

  const allEpisodes = useMemo(
    () => movie.episodes.flatMap((ep) => ep.server_data),
    [movie.episodes],
  );

  // Nghiệp vụ: Xác định tập tiếp theo
  const nextEpSlug = useMemo(() => {
    const idx = allEpisodes.findIndex((s) => String(s.slug) === String(tap));
    return idx !== -1 && idx < allEpisodes.length - 1
      ? allEpisodes[idx + 1].slug
      : null;
  }, [tap, allEpisodes]);

  // 1. Khởi tạo dữ liệu lần đầu cực êm (tránh flash UI)
  useEffect(() => {
    const loadInitialHistory = () => {
      let initialProgress = history?.episodes_progress || {};

      if (!user && !history) {
        const localData = getLocalHistory().find(
          (h) => h.movie_slug === movie.slug,
        );
        if (localData?.episodes_progress) {
          initialProgress = localData.episodes_progress;
        }
      }

      setSessionProgress(initialProgress);
      setIsInitializing(false);

      // Nếu không có param ?tap trên URL, tự động redirect về tập đang xem dở
      if (!tap) {
        const localHist = getLocalHistory().find(
          (h) => h.movie_slug === movie.slug,
        );
        const targetEp = user
          ? history?.last_episode_slug
          : localHist?.last_episode_slug;
        const finalTap = targetEp || allEpisodes[0]?.slug;
        if (finalTap) router.replace(`?tap=${finalTap}`, { scroll: false });
      }
    };
    loadInitialHistory();
  }, [history, movie.slug, user, tap, allEpisodes, router]);

  // Nghiệp vụ: Lấy giây Resume chuẩn (Nếu đã xem xong -> Trả về 0)
  const resumeTime = useMemo(() => {
    if (!tap || isInitializing) return 0;
    const epData = sessionProgress[tap];
    if (!epData) return 0;
    return epData.ep_is_finished ? 0 : Number(epData.ep_last_time || 0);
  }, [tap, sessionProgress, isInitializing]);

  // 3. Hàm đồng bộ Core
  const syncHistory = useCallback(() => {
    if (!tap || playbackRef.current.currentTime < 2) return;

    const { currentTime, duration } = playbackRef.current;
    const now = new Date().toISOString();

    // Nghiệp vụ: Check xem xong chưa?
    const isFinishingEp =
      duration > 0 && currentTime / duration >= CONSTANTS.COMPLETED_THRESHOLD;

    setSessionProgress((prev) => {
      const newEpProgress: EpisodeProgress = {
        ep_last_time: currentTime,
        ep_duration: duration,
        ep_is_finished: isFinishingEp,
        ep_updated_at: now,
      };

      const updatedMap = { ...prev, [tap]: newEpProgress };

      // Nghiệp vụ: Chuyển Card "Đang xem" mượt mà
      // - Nếu xem xong tập hiện tại và CÒN tập tiếp theo -> last_episode = tập tiếp theo, is_finished (movie) = false.
      // - Nếu xem xong tập cuối -> last_episode = tập cuối, is_finished (movie) = true.
      const targetLastEpSlug = isFinishingEp && nextEpSlug ? nextEpSlug : tap;
      const isMovieCompletelyFinished = isFinishingEp && !nextEpSlug;

      const updatedItem: HistoryItem = {
        movie_slug: movie.slug,
        movie_name: movie.name,
        movie_poster: movie.poster_url,
        episodes_progress: updatedMap,
        last_episode_slug: targetLastEpSlug,
        is_finished: isMovieCompletelyFinished,
        updated_at: now,
      };
      //
      if (user) {
        // Dùng keepalive: true là chuẩn bài để request ko bị trình duyệt huỷ khi người dùng tắt tab
        fetch("/api/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedItem),
          keepalive: true,
        }).catch(console.error);
      } else {
        saveLocalHistory(updatedItem);
      }
      return updatedMap;
    });

    playbackRef.current.lastSavedTime = currentTime;
  }, [movie, tap, user, nextEpSlug]);

  // 4. Xử lý lưu khi người dùng tắt Tab / Đổi Tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") syncHistory();
    };
    window.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      syncHistory(); // Lưu phát cuối khi Unmount
    };
  }, [syncHistory]);

  // Cập nhật ref khi đổi tập
  useEffect(() => {
    playbackRef.current.currentTime = resumeTime;
    playbackRef.current.lastSavedTime = resumeTime;
  }, [tap, resumeTime]);

  const activeEpisode = allEpisodes.find((e) => String(e.slug) === String(tap));

  if (isInitializing || !tap)
    return (
      <div className="h-[60vh] flex items-center justify-center text-zinc-500">
        Đang tải tiến trình...
      </div>
    );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div id="video" className="scroll-mt-24">
        {activeEpisode && (
          <VideoPlayer
            // KEY CHUẨN: Link đổi thì render lại player mới hoàn toàn
            key={`${movie.slug}-${tap}`}
            movieSrc={activeEpisode.link_m3u8}
            movieName={`${movie.name} - Tập ${activeEpisode.name}`}
            nextEpisodeSlug={nextEpSlug}
            initialTime={resumeTime}
            onProgress={(c, d) => {
              playbackRef.current.currentTime = c;
              playbackRef.current.duration = d;
              // Tối ưu: Chỉ gọi API save mỗi 15s
              if (
                Math.abs(c - playbackRef.current.lastSavedTime) >=
                CONSTANTS.SAVE_INTERVAL_SEC
              ) {
                syncHistory();
              }
            }}
            onAutoNext={() => {
              syncHistory(); // Lưu nốt trước khi nhảy
              if (nextEpSlug)
                router.push(`?tap=${nextEpSlug}#video`, { scroll: false });
            }}
          />
        )}
      </div>

      <div className="bg-zinc-900/40 p-6 rounded-3xl border border-zinc-800 shadow-xl backdrop-blur-md">
        <h3 className="text-lg font-bold text-white mb-4 uppercase tracking-wider">
          Danh sách tập
        </h3>
        <EpisodeList
          servers={movie.episodes}
          episodeSelected={tap}
          onSelect={(sv) =>
            router.push(`?tap=${sv.slug}#video`, { scroll: false })
          }
        />
      </div>
    </div>
  );
}
