"use client";

import { useEffect, useRef } from "react";
import videojs from "video.js";
import Player from "video.js/dist/types/player";
import "video.js/dist/video-js.css";
import "@videojs/themes/dist/city/index.css";
import "videojs-hotkeys";
import {
  getPausedHeartbeatInterval,
  usePlaybackPlayerBridge,
} from "@/features/watch-party/playback-sync";
import { PlayerSyncRef } from "@/types";

export { getPausedHeartbeatInterval };

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
  onHeartbeatSync?: (time: number, isPaused: boolean) => void;
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
  onHeartbeatSync,
  playerSyncRef,
  onPlayerReady,
}: UseVideoPlayerProps) {
  const playerRef = useRef<Player | null>(null);
  const currentMovieSrcRef = useRef<string>(movieSrc);
  const isInitialSeekDone = useRef(false);
  const lastProgressTime = useRef<number>(0);
  const isComponentUnmounted = useRef<boolean>(false);

  const refs = useRef({
    onProgress,
    onAutoNext,
    onPause,
    isAutoNext,
    nextEpisodeSlug,
    canControl,
    isHost,
    onPlayerReady,
    isWatchParty,
  });

  const playbackBridge = usePlaybackPlayerBridge({
    isWatchParty,
    canControl,
    isHost,
    getPlayer: () => playerRef.current as ExtendedPlayer | null,
    isComponentUnmounted: () => isComponentUnmounted.current,
    onPlaySync,
    onPauseSync,
    onSeekSync,
    onHeartbeatSync,
  });
  const playbackBridgeRef = useRef(playbackBridge);
  playbackBridgeRef.current = playbackBridge;

  const { syncFromRemote, syncHeartbeat, getCurrentState } = playbackBridge;

  useEffect(() => {
    refs.current = {
      onProgress,
      onAutoNext,
      onPause,
      isAutoNext,
      nextEpisodeSlug,
      canControl,
      isHost,
      onPlayerReady,
      isWatchParty,
    };
  }, [
    onProgress,
    onAutoNext,
    onPause,
    isAutoNext,
    nextEpisodeSlug,
    canControl,
    isHost,
    onPlayerReady,
    isWatchParty,
  ]);

  useEffect(() => {
    if (!isWatchParty) return;

    document.addEventListener("visibilitychange", playbackBridge.suppressLifecycleSync);
    window.addEventListener("pagehide", playbackBridge.suppressLifecycleSync);
    window.addEventListener("blur", playbackBridge.suppressLifecycleSync);

    return () => {
      document.removeEventListener("visibilitychange", playbackBridge.suppressLifecycleSync);
      window.removeEventListener("pagehide", playbackBridge.suppressLifecycleSync);
      window.removeEventListener("blur", playbackBridge.suppressLifecycleSync);
    };
  }, [isWatchParty, playbackBridge.suppressLifecycleSync]);

  useEffect(() => {
    if (!isWatchParty || isHost) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;

      const player = playerRef.current as ExtendedPlayer;
      if (!player || player.isDisposed?.()) return;
      if (isComponentUnmounted.current) return;

      const isPlayerBusy =
        player.seeking() ||
        (typeof player.readyState === "function" && player.readyState() < 2);
      if (isPlayerBusy) return;

      const actualHostTime = playbackBridgeRef.current.getSyncedTargetTime();
      const myTime = getPlayerTime(player);
      const syncThreshold = typeof player.paused === "function" && player.paused() ? 0.5 : 1.5;

      if (Math.abs(actualHostTime - myTime) > syncThreshold) {
        setPlayerTime(player, actualHostTime);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isWatchParty, isHost, playbackBridge]);

  useEffect(() => {
    const videoContainer = videoRef.current;
    if (!videoContainer || !movieSrc) return;
    isComponentUnmounted.current = false;

    let rateAnimFrame = 0;
    let player: Player;

    if (!playerRef.current) {
      currentMovieSrcRef.current = movieSrc;
      isInitialSeekDone.current = false;
      lastProgressTime.current = 0;

      const videoElement = document.createElement("video");
      videoElement.className = "video-js vjs-big-play-centered vjs-vmovie-theme";
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

        if (playbackBridgeRef.current.applyPendingInitialSync()) {
          isInitialSeekDone.current = true;
        } else if (!isInitialSeekDone.current) {
          player.currentTime(initialTime || 0);
          isInitialSeekDone.current = true;
        }

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
        const markUserIntent = () => playbackBridgeRef.current.markUserIntent();

        domEl.addEventListener("pointerdown", markUserIntent, true);
        domEl.addEventListener("pointerup", markUserIntent, true);
        domEl.addEventListener("touchstart", markUserIntent, true);
        domEl.addEventListener("touchend", markUserIntent, true);
        domEl.addEventListener("keydown", markUserIntent, true);
        domEl.addEventListener("keyup", markUserIntent, true);
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

      player.on("play", () => playbackBridgeRef.current.commitNetworkSync("play"));
      player.on("pause", () => {
        refs.current.onPause?.();
        playbackBridgeRef.current.commitNetworkSync("pause");
      });
      player.on("seeked", () => {
        playbackBridgeRef.current.commitNetworkSync("seek");
      });

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
            const displayRate =
              !isStandard && rate >= 0.9 && rate <= 1.1
                ? 1
                : Number(rate.toFixed(2));
            const newText = `${displayRate}x`;

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

        if (refs.current.isWatchParty && !refs.current.isHost) {
          playbackBridgeRef.current.runSoftSync();
        }

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
          if (dur - curr <= 15 && dur - curr > 0 && curr >= 10) {
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
          player.currentTime(isWatchParty ? 0 : initialTime);
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
        if (rateAnimFrame) cancelAnimationFrame(rateAnimFrame);
        player.dispose();
        playerRef.current = null;
        if (videoContainer) videoContainer.innerHTML = "";
      }
    };
  }, [movieSrc, videoRef, initialTime, isWatchParty]);

  useEffect(() => {
    if (playerSyncRef) {
      playerSyncRef.current = { syncFromRemote, syncHeartbeat, getCurrentState };
    }
  }, [syncFromRemote, syncHeartbeat, getCurrentState, playerSyncRef]);

  return {
    playerRef,
    syncFromRemote,
    syncHeartbeat,
    getCurrentState,
    isSyncing: playbackBridge.isSyncing,
  };
}
