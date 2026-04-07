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
import EpisodeSelector from "@/components/EpisodeSelector";

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
  handleTimeUpdate: (currentTime: number, duration: number) => void;
  handlePause?: () => void;
  autoNextEnabled?: boolean;
}

const CONSTANTS = {
  SAVE_INTERVAL_SEC: 15, // Cứ 15s lưu 1 lần để tối ưu API/LocalStorage
  COMPLETED_THRESHOLD: 0.95, // Xem 95% coi như xong tập
};

export default function WatchMovie({
  movie,
  history,
  user,
  handleTimeUpdate,
  handlePause,
  autoNextEnabled = true,
}: Props) {
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
  });

  const allEpisodes = useMemo(
    () => movie.episodes.flatMap((ep: any) => ep.server_data),
    [movie.episodes],
  );

  // Nghiệp vụ: Xác định tập tiếp theo và tập trước
  const { nextEpSlug, prevEpSlug } = useMemo(() => {
    const idx = allEpisodes.findIndex(
      (s: any) => String(s.slug) === String(tap),
    );
    return {
      nextEpSlug:
        idx !== -1 && idx < allEpisodes.length - 1
          ? allEpisodes[idx + 1].slug
          : null,
      prevEpSlug: idx > 0 ? allEpisodes[idx - 1].slug : null,
    };
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
    // Nếu ep_last_time quá gần ep_duration (> 98%), bắt đầu lại từ đầu
    if (
      epData.ep_duration > 0 &&
      epData.ep_last_time / epData.ep_duration > 0.98
    ) {
      return 0;
    }
    return epData.ep_is_finished ? 0 : Number(epData.ep_last_time || 0);
  }, [tap, sessionProgress, isInitializing]);

  // 3. Lưu local progress cho UI (không gọi API trực tiếp)
  // Tracking và sync lên Supabase đã được xử lý bởi useWatchHistory hook
  const saveLocalProgress = useCallback(() => {
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

      // Với guest user, lưu vào LocalStorage để UI cập nhật ngay
      if (!user) {
        const targetLastEpSlug = isFinishingEp && nextEpSlug ? nextEpSlug : tap;
        const isMovieCompletelyFinished = isFinishingEp && !nextEpSlug;

        // Lấy existing history để merge episodes_progress
        const existingLocalHistory = getLocalHistory();
        const existingMovie = existingLocalHistory.find(
          (h) => h.movie_slug === movie.slug,
        );
        const existingProgress = existingMovie?.episodes_progress || {};

        // Merge với existing progress (giữ lại tất cả tập đã xem)
        const mergedProgress = {
          ...existingProgress,
          ...updatedMap,
        };

        const updatedItem: HistoryItem = {
          movie_slug: movie.slug,
          movie_name: movie.name,
          movie_poster: movie.poster_url,
          episodes_progress: mergedProgress,
          last_episode_slug: targetLastEpSlug,
          is_finished: isMovieCompletelyFinished,
          updated_at: now,
        };
        saveLocalHistory(updatedItem);
      }

      return updatedMap;
    });
  }, [movie, tap, user, nextEpSlug]);

  // Callback ổn định cho onProgress (tránh re-render VideoPlayer)
  const handleProgress = useCallback(
    (currentTime: number, duration: number) => {
      playbackRef.current.currentTime = currentTime;
      playbackRef.current.duration = duration;
      handleTimeUpdate(currentTime, duration);
    },
    [handleTimeUpdate],
  );

  // Callback ổn định cho onAutoNext (tránh re-render VideoPlayer)
  const handleAutoNext = useCallback(() => {
    saveLocalProgress();
    if (nextEpSlug) router.push(`?tap=${nextEpSlug}#video`, { scroll: false });
  }, [saveLocalProgress, nextEpSlug, router]);

  // Cập nhật ref khi đổi tập
  useEffect(() => {
    playbackRef.current.currentTime = resumeTime;
  }, [tap, resumeTime]);

  const activeEpisode = allEpisodes.find(
    (e: any) => String(e.slug) === String(tap),
  );

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
            prevEpisodeSlug={prevEpSlug}
            initialTime={resumeTime}
            onProgress={handleProgress}
            onAutoNext={handleAutoNext}
            onPause={handlePause}
            autoNextEnabled={autoNextEnabled}
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
          onSelect={(sv: any) =>
            router.push(`?tap=${sv.slug}#video`, { scroll: false })
          }
          episodesProgress={sessionProgress}
        />
      </div>
    </div>
  );
}
