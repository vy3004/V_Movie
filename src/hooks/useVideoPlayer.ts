"use client";

import { useEffect, useRef } from "react";
import videojs from "video.js";
import Player from "video.js/dist/types/player";
import "video.js/dist/video-js.css";
import "@videojs/themes/dist/city/index.css";
import "videojs-hotkeys";

interface UseVideoPlayerProps {
  videoRef: React.RefObject<HTMLDivElement>;
  movieSrc: string;
  initialTime: number;
  nextEpisodeSlug?: string | null;
  isAutoNext: boolean;
  onProgress: (currentTime: number, duration: number) => void;
  onAutoNext: () => void;
  onPause?: () => void;
}

export function useVideoPlayer({
  videoRef,
  movieSrc,
  initialTime,
  nextEpisodeSlug,
  isAutoNext,
  onProgress,
  onAutoNext,
  onPause,
}: UseVideoPlayerProps) {
  const playerRef = useRef<Player | null>(null);
  const isInitialSeekDone = useRef(false);
  const isSeekingRef = useRef(false);
  const lastProgressTime = useRef<number>(0);

  // Refs cho callbacks để tránh re-init player khi props thay đổi
  const refs = useRef({
    onProgress,
    onAutoNext,
    onPause,
    isAutoNext,
    nextEpisodeSlug,
  });

  useEffect(() => {
    refs.current = {
      onProgress,
      onAutoNext,
      onPause,
      isAutoNext,
      nextEpisodeSlug,
    };
  }, [onProgress, onAutoNext, onPause, isAutoNext, nextEpisodeSlug]);

  useEffect(() => {
    const videoContainer = videoRef.current;
    if (!videoContainer || !movieSrc) return;

    let player: Player;

    // --- KHỞI TẠO PLAYER LẦN ĐẦU ---
    if (!playerRef.current) {
      isInitialSeekDone.current = false;
      lastProgressTime.current = 0;

      const videoElement = document.createElement("video");
      videoElement.className =
        "video-js vjs-big-play-centered vjs-vmovie-theme";
      videoRef.current.appendChild(videoElement);

      player = playerRef.current = videojs(videoElement, {
        autoplay: false,
        controls: true,
        fluid: true,
        playbackRates: [0.5, 1, 1.25, 1.5, 2],
        aspectRatio: "16:9",
        sources: [{ src: movieSrc, type: "application/x-mpegURL" }],
      });

      // Plugins/Overlay logic
      const nextBtn = player.addChild("NextEpisodeButton", {
        onAutoNext: () => refs.current.onAutoNext(),
      });
      nextBtn.hide();

      player.hotkeys({
        volumeStep: 0.1,
        seekStep: 10,
        enableVolumeScroll: false,
        alwaysCaptureHotkeys: true,
      });

      // --- EVENT LISTENERS ---
      player.on("loadedmetadata", () => {
        // Chỉ seek nếu chưa từng seek cho source này
        if (initialTime > 0 && !isInitialSeekDone.current) {
          player.currentTime(initialTime);
          isInitialSeekDone.current = true;
        }
      });

      player.on("seeking", () => {
        isSeekingRef.current = true;
      });
      player.on("seeked", () => {
        isSeekingRef.current = false;
      });

      player.on("timeupdate", () => {
        const curr = player.currentTime() ?? 0;
        const dur = player.duration() ?? 0;
        const flooredCurr = Math.floor(curr);

        if (
          flooredCurr > 0 &&
          flooredCurr % 5 === 0 &&
          flooredCurr !== lastProgressTime.current
        ) {
          lastProgressTime.current = flooredCurr;
          refs.current.onProgress(curr, dur);
        }

        // Next Episode Overlay
        if (
          refs.current.nextEpisodeSlug &&
          dur > 0 &&
          refs.current.isAutoNext
        ) {
          const timeLeft = dur - curr;
          if (timeLeft <= 15 && timeLeft > 0) {
            nextBtn.show();
            nextBtn.addClass("is-active");
          } else {
            nextBtn.hide();
            nextBtn.removeClass("is-active");
          }
        }
      });

      player.on("ended", () => {
        if (refs.current.nextEpisodeSlug && refs.current.isAutoNext)
          refs.current.onAutoNext();
      });

      player.on("pause", () => {
        if (!isSeekingRef.current) refs.current.onPause?.();
      });

      player.on("volumechange", () => {
        localStorage.setItem("v_movie_volume", String(player.volume()));
      });

      const savedVol = localStorage.getItem("v_movie_volume");
      if (savedVol) player.volume(Number(savedVol));
    } else {
      // --- XỬ LÝ KHI PROPS THAY ĐỔI ---
      player = playerRef.current;

      // 1. Nếu đổi phim: Reset toàn bộ state và load source mới
      if (player.currentSrc() !== movieSrc) {
        isInitialSeekDone.current = false;
        lastProgressTime.current = 0;
        player.src({ src: movieSrc, type: "application/x-mpegURL" });
        player.load();
      }
      // 2. Nếu phim cũ nhưng initialTime thay đổi VÀ chưa thực hiện seek lần đầu
      // (Hữu ích khi initialTime được nạp chậm từ API)
      else if (initialTime > 0 && !isInitialSeekDone.current) {
        if (player.readyState() >= 1) {
          // Đã có metadata
          player.currentTime(initialTime);
          isInitialSeekDone.current = true;
        }
        // Nếu chưa có metadata, logic trong sự kiện 'loadedmetadata' ở trên sẽ tự xử lý
      }
    }

    // --- CLEANUP ---
    return () => {
      if (player && !player.isDisposed()) {
        player.dispose();
        playerRef.current = null;
        if (videoContainer) videoContainer.innerHTML = "";
      }
    };
  }, [movieSrc, initialTime, videoRef]); // Thêm initialTime và videoContainer để handle dữ liệu nạp chậm

  return { playerRef };
}
