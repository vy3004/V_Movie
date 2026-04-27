"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { toast } from "sonner";
import videojs from "video.js";
import Player from "video.js/dist/types/player";
import "video.js/dist/video-js.css";
import "@videojs/themes/dist/city/index.css";
import "videojs-hotkeys";
import { PlayerSyncRef } from "@/types";

const STANDARD_RATES = [0.5, 1, 1.25, 1.5, 2];

interface UseVideoPlayerProps {
  videoRef: React.RefObject<HTMLDivElement>;
  movieSrc: string;
  initialTime: number;
  nextEpisodeSlug?: string | null;
  isAutoNext: boolean;
  onProgress: (currentTime: number, duration: number) => void;
  onAutoNext: () => void;
  onPause?: () => void;
  isWatchParty?: boolean;
  canControl?: boolean;
  isHost?: boolean;
  onPlaySync?: (time: number) => void;
  onPauseSync?: (time: number) => void;
  onSeekSync?: (time: number) => void;
  playerSyncRef?: React.MutableRefObject<PlayerSyncRef | null>;
  onPlayerReady?: () => void;
}

type ExtendedPlayer = Player & {
  scrubbing?: () => boolean;
  tech_?: unknown;
};

const getPlayerTime = (p: ExtendedPlayer) =>
  typeof p.currentTime === "function" ? (p.currentTime() as number) : 0;

const setPlayerTime = (p: ExtendedPlayer, t: number) => {
  if (typeof p.currentTime === "function") p.currentTime(t);
};

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
  canControl = false,
  isHost = false,
  onPlaySync,
  onPauseSync,
  onSeekSync,
  playerSyncRef,
  onPlayerReady,
}: UseVideoPlayerProps) {
  const playerRef = useRef<Player | null>(null);
  const currentMovieSrcRef = useRef<string>(movieSrc);

  const [isSyncing, setIsSyncing] = useState(false);

  const isInitialSeekDone = useRef(false);
  const lastProgressTime = useRef<number>(0);
  const isComponentUnmounted = useRef<boolean>(false);

  const syncAnimFrame = useRef<number>(0);
  const targetHostTime = useRef<number>(0);
  const isHostPaused = useRef<boolean>(true);
  const lastSyncReceivedAt = useRef<number>(0);

  const pendingInitialSync = useRef<{
    action: "play" | "pause" | "seek";
    time: number;
  } | null>(null);
  const remoteLockUntil = useRef<number>(0);

  const refs = useRef({
    onProgress,
    onAutoNext,
    onPause,
    isAutoNext,
    nextEpisodeSlug,
    onPlaySync,
    onPauseSync,
    onSeekSync,
    canControl,
    isHost,
    onPlayerReady,
    isWatchParty,
  });

  const runSoftSync = useCallback(() => {
    if (isComponentUnmounted.current) return;

    const player = playerRef.current as ExtendedPlayer;
    if (!player || refs.current.canControl || isHostPaused.current) return;

    const isPlayerBusy =
      player.seeking() ||
      (typeof player.readyState === "function" && player.readyState() < 2);
    if (isPlayerBusy) {
      syncAnimFrame.current = requestAnimationFrame(runSoftSync);
      return;
    }

    const timeSinceLastSync = (Date.now() - lastSyncReceivedAt.current) / 1000;
    const actualHostTime = targetHostTime.current + timeSinceLastSync;
    const myTime = getPlayerTime(player);
    const gap = actualHostTime - myTime;

    if (Math.abs(gap) > 3.0) {
      setPlayerTime(player, actualHostTime);
    } else if (Math.abs(gap) > 0.1) {
      const newRate = Math.max(0.9, Math.min(1.1, 1.0 + gap * 0.1));
      if (typeof player.playbackRate === "function")
        player.playbackRate(newRate);
    } else {
      if (typeof player.playbackRate === "function") player.playbackRate(1.0);
    }

    syncAnimFrame.current = requestAnimationFrame(runSoftSync);
  }, []);

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
      canControl,
      isHost,
      onPlayerReady,
      isWatchParty,
    };

    if (!canControl && !isHostPaused.current) {
      cancelAnimationFrame(syncAnimFrame.current);
      syncAnimFrame.current = requestAnimationFrame(runSoftSync);
    }
  }, [
    onProgress,
    onAutoNext,
    onPause,
    isAutoNext,
    nextEpisodeSlug,
    onPlaySync,
    onPauseSync,
    onSeekSync,
    canControl,
    isHost,
    onPlayerReady,
    runSoftSync,
    isWatchParty,
  ]);

  const syncFromRemote = useCallback(
    (action: "play" | "pause" | "seek", time: number) => {
      const player = playerRef.current as ExtendedPlayer;
      if (!player) return;

      if (typeof player.readyState === "function" && player.readyState() < 1) {
        pendingInitialSync.current = { action, time };
        return;
      }

      const isCurrentlyPlaying =
        typeof player.paused === "function" ? !player.paused() : false;
      const diff = Math.abs(getPlayerTime(player) - time);

      const isSameAction =
        (action === "play" && isCurrentlyPlaying) ||
        (action === "pause" && !isCurrentlyPlaying);

      if (isSameAction && diff <= 1.5) return;

      remoteLockUntil.current = Date.now() + 1500;
      targetHostTime.current = time;
      lastSyncReceivedAt.current = Date.now();

      if (action === "play") {
        isHostPaused.current = false;
        if (diff > 1.5) {
          setIsSyncing(true);
          setPlayerTime(player, time);
          setTimeout(() => {
            if (!isComponentUnmounted.current) setIsSyncing(false);
          }, 1500);
        }

        if (typeof player.paused === "function" && player.paused()) {
          const playPromise = player.play();
          if (
            playPromise !== undefined &&
            typeof playPromise.catch === "function"
          ) {
            playPromise.catch(() => {
              if (!playerRef.current || player.isDisposed()) return;
              player.muted(true);
              player.play()?.catch(() => {});
              toast.info("Tự động phát (đã tắt tiếng)");
            });
          }
        }
        cancelAnimationFrame(syncAnimFrame.current);
        syncAnimFrame.current = requestAnimationFrame(runSoftSync);
      } else if (action === "pause") {
        isHostPaused.current = true;
        cancelAnimationFrame(syncAnimFrame.current);
        if (typeof player.playbackRate === "function") player.playbackRate(1.0);

        if (typeof player.paused === "function" && !player.paused())
          player.pause();
        if (diff > 1.5) {
          setIsSyncing(true);
          setPlayerTime(player, time);
          setTimeout(() => {
            if (!isComponentUnmounted.current) setIsSyncing(false);
          }, 1000);
        }
      } else if (action === "seek") {
        if (diff > 1.0) {
          setIsSyncing(true);
          setTimeout(() => {
            if (!isComponentUnmounted.current) setIsSyncing(false);
          }, 1000);
        }

        setPlayerTime(player, time);

        if (!isHostPaused.current) {
          const playPromise = player.play();
          if (
            playPromise !== undefined &&
            typeof playPromise.catch === "function"
          ) {
            playPromise.catch(() => {});
          }
        }
      }
    },
    [runSoftSync],
  );

  const getCurrentState = useCallback(() => {
    if (!playerRef.current) return null;
    const p = playerRef.current as ExtendedPlayer;
    return {
      time: getPlayerTime(p),
      isPaused: typeof p.paused === "function" ? p.paused() : false,
    };
  }, []);

  useEffect(() => {
    if (playerSyncRef) {
      playerSyncRef.current = { syncFromRemote, getCurrentState };
    }
  }, [syncFromRemote, getCurrentState, playerSyncRef]);

  useEffect(() => {
    const videoContainer = videoRef.current;
    if (!videoContainer || !movieSrc) return;
    isComponentUnmounted.current = false;

    let globalNetworkTimer: NodeJS.Timeout | null = null;
    let pendingAction: "play" | "pause" | "seek" | null = null;
    let rateAnimFrame: number = 0;

    const commitNetworkSync = (action: "play" | "pause" | "seek") => {
      if (Date.now() < remoteLockUntil.current) return;
      pendingAction = action;
      if (globalNetworkTimer) clearTimeout(globalNetworkTimer);

      globalNetworkTimer = setTimeout(() => {
        if (!pendingAction || !playerRef.current) return;
        const time = getPlayerTime(playerRef.current as ExtendedPlayer);

        if (pendingAction === "play") refs.current.onPlaySync?.(time);
        else if (pendingAction === "pause") refs.current.onPauseSync?.(time);
        else if (pendingAction === "seek") refs.current.onSeekSync?.(time);

        pendingAction = null;
      }, 300);
    };

    let player: Player;

    if (!playerRef.current) {
      currentMovieSrcRef.current = movieSrc;
      isInitialSeekDone.current = false;
      lastProgressTime.current = 0;

      const videoElement = document.createElement("video");
      videoElement.className =
        "video-js vjs-big-play-centered vjs-vmovie-theme";
      videoElement.setAttribute("preservesPitch", "true");
      videoRef.current.appendChild(videoElement);

      player = playerRef.current = videojs(videoElement, {
        autoplay: false,
        controls: true,
        fluid: true,
        playbackRates: STANDARD_RATES,
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

      player.on("loadedmetadata", () => {
        const tech = player.tech(true) as unknown as {
          el: () => HTMLVideoElement;
        };
        if (tech && tech.el()) tech.el().preservesPitch = true;

        if (pendingInitialSync.current) {
          const { action, time } = pendingInitialSync.current;
          syncFromRemote(action, time);
          isInitialSeekDone.current = true;
          pendingInitialSync.current = null;
        } else if (!isInitialSeekDone.current) {
          if (isWatchParty) {
            setIsSyncing(true);
            remoteLockUntil.current = Date.now() + 2500;
            setTimeout(() => {
              if (!isComponentUnmounted.current) setIsSyncing(false);
            }, 2500);
          }
          player.currentTime(initialTime || 0);
          isInitialSeekDone.current = true;
        }

        // Khôi phục âm lượng TẠI ĐÂY cho Player
        const savedVol = localStorage.getItem("v_movie_volume");
        if (savedVol !== null) {
          const vol = Number(savedVol);
          if (!isNaN(vol) && vol >= 0 && vol <= 1) {
            player.volume(vol);
          }
        }

        refs.current.onPlayerReady?.();
      });

      const domEl = player.el();
      if (domEl) {
        domEl.addEventListener(
          "pointerdown",
          () => {
            remoteLockUntil.current = 0;
          },
          true,
        );
      }

      player.on("fullscreenchange", () => {
        if (player.isFullscreen()) {
          try {
            if (
              window.screen &&
              window.screen.orientation &&
              window.screen.orientation.unlock
            ) {
              window.screen.orientation.unlock();
            }
          } catch (error) {
            console.warn("Không thể mở khóa xoay màn hình thiết bị:", error);
          }
        }
      });

      player.on("play", () => commitNetworkSync("play"));
      player.on("pause", () => {
        refs.current.onPause?.();
        commitNetworkSync("pause");
      });
      player.on("seeking", () => {
        const extPlayer = player as ExtendedPlayer;
        if (typeof extPlayer.scrubbing === "function" && extPlayer.scrubbing())
          remoteLockUntil.current = 0;
        commitNetworkSync("seek");
      });
      player.on("seeked", () => commitNetworkSync("seek"));

      // LÀM ĐẸP CHỈ SỐ TỐC ĐỘ KHI SOFT SYNC
      let cachedRateEl: Element | null = null;

      player.on("ratechange", () => {
        if (rateAnimFrame) cancelAnimationFrame(rateAnimFrame);

        rateAnimFrame = requestAnimationFrame(() => {
          if (!cachedRateEl) {
            const el = player.el()?.querySelector(".vjs-playback-rate-value");
            if (el) cachedRateEl = el;
          }

          if (cachedRateEl) {
            const rate = player.playbackRate() ?? 1;
            const isStandard = STANDARD_RATES.includes(rate);

            let displayRate;
            // Ép hiển thị thành 1 nếu đang nằm trong khoảng bù trừ của Soft Sync (0.85 -> 1.15)
            if (!isStandard && rate >= 0.9 && rate <= 1.1) {
              displayRate = 1;
            } else {
              // Vẫn giữ lại phần thập phân cho các tốc độ người dùng tự chọn (VD: 1.25, 1.5, 0.5)
              displayRate = Number(rate.toFixed(2));
            }

            const newText = `${displayRate}x`;

            // Chỉ thao tác với DOM nếu text thực sự cần thay đổi
            if (cachedRateEl.textContent !== newText) {
              cachedRateEl.textContent = newText;
            }
          }
        });
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

        const mightHaveNextContent =
          refs.current.nextEpisodeSlug || refs.current.isWatchParty;
        const hasPermission =
          !refs.current.isWatchParty || refs.current.canControl;

        if (
          mightHaveNextContent &&
          hasPermission &&
          dur > 0 &&
          refs.current.isAutoNext
        ) {
          if (dur - curr <= 15 && dur - curr > 0) {
            nextBtn.show();
            nextBtn.addClass("is-active");
          } else {
            nextBtn.hide();
            nextBtn.removeClass("is-active");
          }
        } else {
          nextBtn.hide();
          nextBtn.removeClass("is-active");
        }
      });

      player.on("ended", () => {
        if (refs.current.isAutoNext) {
          refs.current.onAutoNext();
        }
      });
    } else {
      player = playerRef.current;
      if (currentMovieSrcRef.current !== movieSrc) {
        currentMovieSrcRef.current = movieSrc;
        isInitialSeekDone.current = false;
        lastProgressTime.current = 0;
        player.src({ src: movieSrc, type: "application/x-mpegURL" });
        player.load();

        player.one("loadedmetadata", () => {
          player.currentTime(initialTime);
          isInitialSeekDone.current = true;
        });
      } else if (initialTime > 0 && !isInitialSeekDone.current) {
        if (player.readyState() >= 1) {
          player.currentTime(initialTime);
          isInitialSeekDone.current = true;
        }
      }
    }

    return () => {
      if (player && !player.isDisposed()) {
        isComponentUnmounted.current = true;
        cancelAnimationFrame(syncAnimFrame.current);
        if (rateAnimFrame) cancelAnimationFrame(rateAnimFrame);
        if (globalNetworkTimer) clearTimeout(globalNetworkTimer);
        player.dispose();
        playerRef.current = null;
        if (videoContainer) videoContainer.innerHTML = "";
      }
    };
  }, [movieSrc, videoRef, initialTime, isWatchParty, syncFromRemote]);

  return { playerRef, syncFromRemote, getCurrentState, isSyncing };
}
