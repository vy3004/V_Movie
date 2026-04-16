"use client";

import { useEffect, useRef, useCallback } from "react";
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
  // --- Props cho Watch Party ---
  isWatchParty?: boolean;
  isHost?: boolean;
  onPlaySync?: (time: number) => void;
  onPauseSync?: (time: number) => void;
  onSeekSync?: (time: number) => void;
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
  isWatchParty = false,
  isHost = false,
  onPlaySync,
  onPauseSync,
  onSeekSync,
}: UseVideoPlayerProps) {
  const playerRef = useRef<Player | null>(null);
  const isInitialSeekDone = useRef(false);
  const isSeekingRef = useRef(false);
  const lastProgressTime = useRef<number>(0);

  // Cờ chặn vòng lặp vô hạn: Để xác định sự kiện play/pause là do User click hay do Sync từ xa
  const isRemoteAction = useRef(false);

  // Refs cho callbacks để tránh re-init player khi props (như isHost) thay đổi
  const refs = useRef({
    onProgress,
    onAutoNext,
    onPause,
    isAutoNext,
    nextEpisodeSlug,
    onPlaySync,
    onPauseSync,
    onSeekSync,
    isWatchParty,
    isHost,
  });

  useEffect(() => {
    refs.current = {
      onProgress,
      onAutoNext,
      onPause,
      isAutoNext,
      nextEpisodeSlug,
      onPlaySync,
      onPauseSync,
      onSeekSync,
      isWatchParty,
      isHost,
    };
  }, [
    onProgress,
    onAutoNext,
    onPause,
    isAutoNext,
    nextEpisodeSlug,
    onPlaySync,
    onPauseSync,
    onSeekSync,
    isWatchParty,
    isHost,
  ]);

  // --- Hàm điều khiển dành cho Guest (Nhận lệnh từ Host) ---
  const syncFromRemote = useCallback(
    (action: "play" | "pause" | "seek", time: number) => {
      const player = playerRef.current;
      if (!player) return;

      isRemoteAction.current = true; // Bật cờ chặn trước khi thực hiện lệnh

      const currentTime = player.currentTime() || 0;
      const diff = Math.abs(currentTime - time);

      switch (action) {
        case "play":
          // Nếu lệch quá 2s thì mới sync time để tránh giật hình cho Guest mạng yếu
          if (diff > 2) player.currentTime(time);
          player.play();
          break;
        case "pause":
          player.currentTime(time);
          player.pause();
          break;
        case "seek":
          player.currentTime(time);
          break;
      }

      // Sau khi thực hiện lệnh programmatic, cờ sẽ được reset ở các event listener bên dưới
    },
    [],
  );

  useEffect(() => {
    const videoContainer = videoRef.current;
    if (!videoContainer || !movieSrc) return;

    let player: Player;

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
        if (initialTime > 0 && !isInitialSeekDone.current) {
          player.currentTime(initialTime);
          isInitialSeekDone.current = true;
        }
      });

      player.on("play", () => {
        // Chỉ Host mới gửi tín hiệu Play và chỉ khi KHÔNG phải do lệnh Remote
        if (
          refs.current.isWatchParty &&
          refs.current.isHost &&
          !isRemoteAction.current
        ) {
          refs.current.onPlaySync?.(player.currentTime() || 0);
        }
        isRemoteAction.current = false; // Luôn reset cờ sau khi xử lý
      });

      player.on("pause", () => {
        // Khi Pause, cờ sẽ reset sync lịch sử xem
        if (!isSeekingRef.current) refs.current.onPause?.();

        // Chi đồng bộ Watch Party cho Host
        if (
          refs.current.isWatchParty &&
          refs.current.isHost &&
          !isRemoteAction.current
        ) {
          refs.current.onPauseSync?.(player.currentTime() || 0);
        }
        isRemoteAction.current = false;
      });

      player.on("seeking", () => {
        isSeekingRef.current = true;
      });

      player.on("seeked", () => {
        isSeekingRef.current = false;
        // Host đồng bộ thời điểm mới khi tua xong
        if (
          refs.current.isWatchParty &&
          refs.current.isHost &&
          !isRemoteAction.current
        ) {
          refs.current.onSeekSync?.(player.currentTime() || 0);
        }
        isRemoteAction.current = false;
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

      player.on("volumechange", () => {
        localStorage.setItem("v_movie_volume", String(player.volume()));
      });

      const savedVol = localStorage.getItem("v_movie_volume");
      if (savedVol) player.volume(Number(savedVol));
    } else {
      player = playerRef.current;
      if (player.currentSrc() !== movieSrc) {
        isInitialSeekDone.current = false;
        lastProgressTime.current = 0;
        player.src({ src: movieSrc, type: "application/x-mpegURL" });
        player.load();
      } else if (initialTime > 0 && !isInitialSeekDone.current) {
        if (player.readyState() >= 1) {
          player.currentTime(initialTime);
          isInitialSeekDone.current = true;
        }
      }
    }

    return () => {
      if (player && !player.isDisposed()) {
        player.dispose();
        playerRef.current = null;
        if (videoContainer) videoContainer.innerHTML = "";
      }
    };
  }, [movieSrc, initialTime, videoRef]);

  return { playerRef, syncFromRemote };
}
