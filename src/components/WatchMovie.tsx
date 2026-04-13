"use client";

import dynamic from "next/dynamic";
import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query"; // Thêm để quản lý cache
import EpisodeSelector from "@/components/EpisodeSelector";
import CommentSection from "@/components/CommentSection";
import {
  Movie,
  HistoryItem,
  EpisodeProgress,
  Episode,
  ServerData,
  SubscriptionItem,
} from "@/lib/types";
import { getLocalHistory, getLocalSubscriptions } from "@/lib/utils";
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
  const queryClient = useQueryClient();
  const tap = searchParams.get("tap");

  const [sessionProgress, setSessionProgress] = useState<
    Record<string, EpisodeProgress>
  >({});
  const [isInitializing, setIsInitializing] = useState(true);

  const [activeServerIdx, setActiveServerIdx] = useState(() => {
    const idx = movie.episodes.findIndex((s) => s.server_data.length > 0);
    return idx >= 0 ? idx : 0;
  });

  const isClearingBadge = useRef(false);

  const allEpisodes = useMemo(
    () => movie.episodes.flatMap((ep: Episode) => ep.server_data),
    [movie.episodes],
  );

  // 1. Sử dụng hook watch history để tracking
  const { handleTimeUpdate, syncToSupabase } = useWatchHistory({
    user,
    movie,
    episodeSlug: tap || "",
  });

  // 2. Logic Xử lý Xóa nhãn "Tập mới" (Clear Badge)
  useEffect(() => {
    const handleClearBadge = async () => {
      // 1. Nếu đang gọi rồi hoặc đã gọi xong thì bỏ qua
      if (isClearingBadge.current) return;

      const subsList = queryClient.getQueryData<SubscriptionItem[]>([
        "subscriptions-list",
        user?.id || "guest",
      ]);
      const currentSub = subsList?.find((s) => s.movie_slug === movie.slug);

      // Kiểm tra kỹ giá trị (vì Redis có thể trả về string "true")
      const hasNew =
        currentSub?.has_new_episode === true ||
        String(currentSub?.has_new_episode) === "true";

      if (hasNew) {
        isClearingBadge.current = true; // Chặn ngay lập tức

        if (user) {
          try {
            await fetch("/api/subscriptions/clear-badge", {
              method: "POST",
              body: JSON.stringify({ movieSlug: movie.slug }),
            });

            // (Optimistic Update) cho Cache local ngay lập tức
            // Việc này giúp UI mất chấm đỏ ngay mà không cần đợi API GET lại
            queryClient.setQueryData(
              ["subscriptions-list", user.id],
              (old: SubscriptionItem[] | undefined) => {
                return old?.map((s) =>
                  s.movie_slug === movie.slug
                    ? { ...s, has_new_episode: false }
                    : s,
                );
              },
            );
          } catch (e) {
            console.error("Failed to clear server badge", e);
          }
        } else {
          // Trường hợp Guest: Cập nhật trực tiếp LocalStorage
          const localSubs = getLocalSubscriptions();
          const updatedSubs = localSubs.map((s) =>
            s.movie_slug === movie.slug ? { ...s, has_new_episode: false } : s,
          );
          localStorage.setItem(
            "v_movie_guest_subscriptions",
            JSON.stringify(updatedSubs),
          );
        }

        // Cập nhật lại UI ngay lập tức để mất chấm đỏ ở các nơi khác (Navbar, Trang chủ)
        queryClient.invalidateQueries({ queryKey: ["subscriptions-list"] });
        queryClient.invalidateQueries({
          queryKey: ["subscription", movie.slug],
        });
      }
    };

    handleClearBadge();
  }, [movie.slug, queryClient, user]);

  // Logic xác định tập tiếp theo/trước
  const { nextEpSlug, prevEpSlug } = useMemo(() => {
    const currentServerEpisodes =
      movie.episodes[activeServerIdx]?.server_data || [];
    const idx = currentServerEpisodes.findIndex(
      (s) => String(s.slug) === String(tap),
    );
    return {
      nextEpSlug:
        idx !== -1 && idx < currentServerEpisodes.length - 1
          ? currentServerEpisodes[idx + 1].slug
          : null,
      prevEpSlug: idx > 0 ? currentServerEpisodes[idx - 1].slug : null,
    };
  }, [tap, activeServerIdx, movie.episodes]);

  // Khởi tạo lịch sử xem ban đầu
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

  // Tính toán thời gian resume (tiếp tục xem)
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

  const activeEpisode = useMemo(() => {
    if (!tap) return null;

    // Ưu tiên: Lấy đúng tập phim của cái Server ĐANG CHỌN
    const serverEpisodes = movie.episodes[activeServerIdx]?.server_data || [];
    const epInActiveServer = serverEpisodes.find(
      (e) => String(e.slug) === String(tap),
    );
    if (epInActiveServer) return epInActiveServer;

    // Dự phòng: Tìm tạm ở server khác nếu lỗi data
    const allEpisodes = movie.episodes.flatMap((ep: Episode) => ep.server_data);
    return allEpisodes.find((e) => String(e.slug) === String(tap));
  }, [tap, activeServerIdx, movie.episodes]);

  if (isInitializing || !tap)
    return (
      <div className="h-[60vh] flex items-center justify-center text-zinc-500">
        Đang tải...
      </div>
    );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div id="video" className="scroll-mt-24">
        {activeEpisode && (
          <VideoPlayer
            key={`${movie.slug}-${tap}-${activeServerIdx}`}
            user={user}
            movie={movie}
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

      {movie.episodes.length > 0 && (
        <EpisodeSelector
          servers={movie.episodes}
          episodeSelected={tap}
          onSelect={handleSelectEpisode}
          episodesProgress={sessionProgress}
          activeServerIdx={activeServerIdx}
          onServerChange={setActiveServerIdx}
        />
      )}

      <CommentSection movieSlug={movie.slug} movieName={movie.name} />
    </div>
  );
}
