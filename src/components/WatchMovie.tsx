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
import { Movie, ServerData } from "@/lib/types";
import { saveLocalHistory, getLocalHistory } from "@/lib/utils";
import EpisodeList from "@/components/EpisodeList";

const VideoPlayer = dynamic(() => import("@/components/VideoPlayer"), {
  ssr: false,
  loading: () => (
    <div className="aspect-video w-full bg-zinc-900 animate-pulse rounded-xl" />
  ),
});

interface WatchMovieProps {
  movie: Movie;
  history: any;
  user: any;
}

const WatchMovie = ({ movie, history, user }: WatchMovieProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tap = searchParams.get("tap");
  const [currentServerData, setCurrentServerData] = useState<ServerData | null>(
    null,
  );

  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  const lastSavedTimeRef = useRef(0);

  const allEpisodes = useMemo(
    () => movie.episodes.flatMap((ep) => ep.server_data),
    [movie.episodes],
  );

  const nextEpSlug = useMemo(() => {
    const idx = allEpisodes.findIndex((s) => s.slug === tap);
    return allEpisodes[idx + 1]?.slug || null;
  }, [tap, allEpisodes]);

  // 1. LOGIC RESUME TỪNG TẬP (JSONB)
  const resumeTime = useMemo(() => {
    if (!tap) return 0;
    const progressObj = user
      ? history?.episodes_progress
      : getLocalHistory().find((h: any) => h.movieSlug === movie.slug)
          ?.episodes_progress;

    const epData = progressObj?.[tap];
    // Nếu tập này đã xong (>95%), trả về 0 để xem lại từ đầu
    return epData?.isFinished ? 0 : Number(epData?.lastTime || 0);
  }, [tap, user, history, movie.slug]);

  // 2. HÀM ĐỒNG BỘ (Bao gồm Next Episode Prediction)
  const syncHistory = useCallback(
    async (forcedIsFinished: boolean = false) => {
      if (!tap || currentTimeRef.current < 1) return;

      const payload = {
        movieSlug: movie.slug,
        movieName: movie.name,
        moviePoster: movie.poster_url,
        episodeSlug: tap,
        lastTime: currentTimeRef.current,
        duration: durationRef.current,
        nextEpisodeSlug: nextEpSlug, // Cực kỳ quan trọng để trang chủ update
        isFinished:
          forcedIsFinished ||
          (durationRef.current > 0 &&
            currentTimeRef.current / durationRef.current > 0.95),
      };

      if (user) {
        fetch("/api/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => {});
      } else {
        saveLocalHistory(payload);
      }
      lastSavedTimeRef.current = currentTimeRef.current;
    },
    [movie, tap, user, nextEpSlug],
  );

  // 3. TỰ ĐỘNG CHỌN TẬP KHI VÀO TRANG
  useEffect(() => {
    if (!tap) {
      const local = getLocalHistory().find(
        (h: any) => h.movieSlug === movie.slug,
      );
      const lastEp = user
        ? history?.last_episode_slug
        : local?.last_episode_slug;
      const targetTap = lastEp || allEpisodes[0]?.slug;
      if (targetTap) router.replace(`?tap=${targetTap}`, { scroll: false });
    }
  }, [tap, history, user, movie.slug, allEpisodes, router]);

  // 4. CẬP NHẬT TẬP VÀ SYNC TỨC THÌ KHI ĐỔI TẬP
  useEffect(() => {
    const activeEp = allEpisodes.find(
      (sv) => sv.slug === tap || Number(sv.slug) === Number(tap),
    );
    if (activeEp) {
      setCurrentServerData(activeEp);
      currentTimeRef.current = 0;
      syncHistory(); // Lưu ngay tập mới chọn để trang chủ cập nhật
    }
  }, [tap, allEpisodes, syncHistory]);

  // 5. EVENT: LƯU KHI THOÁT TRANG
  useEffect(() => {
    const handleExit = () => {
      if (document.visibilityState === "hidden") syncHistory();
    };
    window.addEventListener("visibilitychange", handleExit);
    return () => {
      window.removeEventListener("visibilitychange", handleExit);
      syncHistory();
    };
  }, [syncHistory]);

  return (
    <div className="space-y-8">
      {currentServerData ? (
        <VideoPlayer
          key={`${currentServerData.link_m3u8}-${tap}-${resumeTime}`}
          movieSrc={currentServerData.link_m3u8}
          movieName={`${movie.name} - Tập ${currentServerData.name}`}
          nextEpisodeSlug={nextEpSlug}
          initialTime={resumeTime}
          onProgress={(c, d) => {
            currentTimeRef.current = c;
            durationRef.current = d;
            if (Math.abs(c - lastSavedTimeRef.current) > 30) syncHistory();
          }}
          onAutoNext={() =>
            nextEpSlug &&
            router.push(`?tap=${nextEpSlug}#video`, { scroll: false })
          }
        />
      ) : (
        <div className="aspect-video bg-zinc-900 flex items-center justify-center rounded-xl animate-pulse">
          <p className="text-zinc-500">Đang tải...</p>
        </div>
      )}

      <div className="bg-zinc-900/40 p-6 rounded-2xl border border-zinc-800 shadow-xl backdrop-blur-sm">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <span className="w-1.5 h-6 bg-red-600 rounded-full" /> Danh sách tập
        </h3>
        <EpisodeList
          servers={movie.episodes}
          episodeSelected={tap}
          onSelect={(sv: ServerData) =>
            router.push(`?tap=${sv.slug}#video`, { scroll: false })
          }
        />
      </div>
    </div>
  );
};

export default WatchMovie;
