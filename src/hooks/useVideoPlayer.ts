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

  const [isSyncing, setIsSyncing] = useState(false);

  const isInitialSeekDone = useRef(false);
  const lastProgressTime = useRef<number>(0);
  const lastHeartbeatTime = useRef<number>(0);
  const isComponentUnmounted = useRef<boolean>(false);

  const targetHostTime = useRef<number>(0);
  const isHostPaused = useRef<boolean>(true);
  const lastSyncReceivedAt = useRef<number>(0);

  const pendingInitialSync = useRef<{
    action: "play" | "pause" | "seek";
    time: number;
  } | null>(null);
  const remoteLockUntil = useRef<number>(0);
  const expectedRemoteTime = useRef<number | null>(null);

  // Move rateAnimFrame to useRef for proper cleanup
  const rateAnimFrame = useRef<number>(0);

  const refs = useRef({
    onProgress,
    onAutoNext,
    onPause,
    isAutoNext,
    nextEpisodeSlug,
    onPlaySync,
    onPauseSync,
    onSeekSync,
    onHeartbeatSync,
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
    if (isPlayerBusy) return;

    const timeSinceLastSync = (Date.now() - lastSyncReceivedAt.current) / 1000;
    const actualHostTime = targetHostTime.current + timeSinceLastSync;
    const myTime = getPlayerTime(player);
    const gap = actualHostTime - myTime;

    if (Math.abs(gap) > 3.0) {
      setPlayerTime(player, actualHostTime);
    } else if (Math.abs(gap) > 0.1) {
      const newRate = Math.max(0.9, Math.min(1.1, 1.0 + gap * 0.1));

      // 👑 SENIOR FIX #4: Video.js PlaybackRate Check
      // Chỉ set playback rate nếu thực sự khác với rate hiện tại (tránh trigger event vô ích)
      const currentRate =
        typeof player.playbackRate === "function"
          ? (player.playbackRate() ?? 1.0)
          : 1.0;
      if (Math.abs(currentRate - newRate) > 0.01) {
        player.playbackRate(newRate);
      }
    } else {
      // Reset về 1.0 nếu đã đồng bộ
      const currentRate =
        typeof player.playbackRate === "function"
          ? (player.playbackRate() ?? 1.0)
          : 1.0;
      if (Math.abs(currentRate - 1.0) > 0.01) {
        player.playbackRate(1.0);
      }
    }
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
      onHeartbeatSync,
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
    onPlaySync,
    onPauseSync,
    onSeekSync,
    onHeartbeatSync,
    canControl,
    isHost,
    onPlayerReady,
    isWatchParty,
  ]);

  // 🎯 Page Visibility API: Đồng bộ ngay khi user quay lại tab
  useEffect(() => {
    if (!isWatchParty || canControl) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const player = playerRef.current as ExtendedPlayer;
        if (!player || player.isDisposed?.() || isHostPaused.current) return;
        if (isComponentUnmounted.current) return;

        const isPlayerBusy =
          player.seeking() ||
          (typeof player.readyState === "function" && player.readyState() < 2);
        if (isPlayerBusy) return;

        const timeSinceLastSync =
          (Date.now() - lastSyncReceivedAt.current) / 1000;
        const actualHostTime = targetHostTime.current + timeSinceLastSync;
        const myTime = getPlayerTime(player);

        // Nếu lệch quá 1.5s, hard sync ngay lập tức
        if (Math.abs(actualHostTime - myTime) > 1.5) {
          remoteLockUntil.current = Date.now() + 1500;
          setPlayerTime(player, actualHostTime);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isWatchParty, canControl]);

  const syncFromRemote = useCallback(
    (action: "play" | "pause" | "seek", time: number) => {
      const player = playerRef.current as ExtendedPlayer;
      console.log("[useVideoPlayer] syncFromRemote called:", {
        action,
        time,
        hasPlayer: !!player,
        readyState: player?.readyState?.(),
      });

      // CRITICAL FIX: If player doesn't exist yet, store the sync command
      if (!player) {
        console.log(
          "[useVideoPlayer] Player instance missing, storing pending sync",
        );
        pendingInitialSync.current = { action, time };
        return;
      }

      const readyState =
        typeof player.readyState === "function" ? player.readyState() : 0;

      // CRITICAL FIX: If player not ready (metadata not loaded), store the sync command
      if (readyState < 1) {
        console.log("[useVideoPlayer] Player not ready, storing pending sync");
        pendingInitialSync.current = { action, time };
        return;
      }

      console.log("[useVideoPlayer] Applying sync:", { action, time });

      const isCurrentlyPlaying =
        typeof player.paused === "function" ? !player.paused() : false;
      const diff = Math.abs(getPlayerTime(player) - time);

      // Vì Host chốt sổ trả về play/pause, nếu trùng trạng thái và lệch ít thì kệ nó.
      const isSameAction =
        (action === "play" && isCurrentlyPlaying) ||
        (action === "pause" && !isCurrentlyPlaying);

      if (isSameAction && diff <= 1.5) return;

      // KHÓA MÁY GUEST LẠI (1 GIÂY) ĐỂ KHÔNG DỘI EVENT NGƯỢC LÊN HOST
      remoteLockUntil.current = Date.now() + 1000;

      const adjustedTime = action === "play" ? time + 0.25 : time;
      targetHostTime.current = adjustedTime;
      lastSyncReceivedAt.current = Date.now();

      // Đánh dấu mốc thời gian vừa nhận từ Host
      expectedRemoteTime.current = adjustedTime;

      if (action === "play") {
        isHostPaused.current = false;

        // Host tua đi xa hoặc nhảy cóc -> Hard Sync
        if (diff > 1.5) {
          setIsSyncing(true);
          setPlayerTime(player, adjustedTime);
          setTimeout(() => {
            if (!isComponentUnmounted.current) setIsSyncing(false);
          }, 1500);
        }

        // Ép Play
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
      } else if (action === "pause") {
        isHostPaused.current = true;
        if (typeof player.playbackRate === "function") player.playbackRate(1.0);

        if (typeof player.paused === "function" && !player.paused())
          player.pause();

        // Host Pause ở 1 mốc xa -> Bắt buộc nhảy đến mốc đó
        if (diff > 0.5) {
          setIsSyncing(true);
          setPlayerTime(player, time);
          setTimeout(() => {
            if (!isComponentUnmounted.current) setIsSyncing(false);
          }, 1000);
        }
      }
    },
    [],
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

        console.log(
          "[useVideoPlayer] loadedmetadata fired, checking pending sync:",
          !!pendingInitialSync.current,
        );

        if (pendingInitialSync.current) {
          const { action, time } = pendingInitialSync.current;
          console.log("[useVideoPlayer] Applying pending sync:", {
            action,
            time,
          });
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

      // Xử lý lỗi sập Server Phim (HLS Error)
      player.on("error", () => {
        const error = player.error();
        console.error("[VideoJS] Error:", error);

        if (refs.current.isWatchParty) {
          if (refs.current.canControl) {
            toast.error(
              "Máy chủ phim bị lỗi! Hãy thử đổi sang Server (Vietsub/Lồng tiếng) khác nhé.",
              { duration: 5000 },
            );
            // Tại đây có thể tự động bắn event đổi server nếu bạn đã viết logic đổi Server.
          } else {
            toast.info(
              "Nguồn phim đang bị lỗi. Đang đợi Chủ phòng đổi server...",
              { duration: 5000 },
            );
          }
        } else {
          // Xem một mình
          toast.error("Lỗi nguồn phim, vui lòng chọn Server khác!");
        }
      });

      player.on("play", () => {
        if (Date.now() < remoteLockUntil.current || !refs.current.canControl)
          return;

        // 🌟 CHẶN: Đang bấm giữ chuột kéo thanh thời gian (scrubbing) hoặc đang load (seeking)
        const extPlayer = player as ExtendedPlayer;
        if (player.seeking() || extPlayer.scrubbing?.()) return;

        refs.current.onPlaySync?.(getPlayerTime(extPlayer));
      });

      player.on("pause", () => {
        refs.current.onPause?.(); // Local history luôn chạy

        if (Date.now() < remoteLockUntil.current || !refs.current.canControl)
          return;

        // 🌟 CHẶN: Khi user ấn chuột xuống thanh thời gian, nó tự trigger pause. Ta bỏ qua!
        const extPlayer = player as ExtendedPlayer;
        if (player.seeking() || extPlayer.scrubbing?.()) return;

        refs.current.onPauseSync?.(getPlayerTime(extPlayer));
      });

      // 3. THẢ CHUỘT / TUA BÀN PHÍM HOÀN TẤT (Seeked)
      // Dù dùng phím mũi tên, click chuột, hay kéo thanh gạt, đều kết thúc ở đây.
      player.on("seeked", () => {
        if (!refs.current.canControl) return;

        const extPlayer = player as ExtendedPlayer;
        const time = getPlayerTime(extPlayer);

        // NẾU LÀ DO CODE TỰ TUA (nhận từ remote) -> SAI SỐ SẼ RẤT NHỎ -> BỎ QUA
        if (
          expectedRemoteTime.current !== null &&
          Math.abs(time - expectedRemoteTime.current) < 0.5
        ) {
          expectedRemoteTime.current = null; // Reset cờ
          return; // Chặn dội âm thành công
        }

        // Nếu code chạy đến đây, chắc chắn là do User tự dùng tay tua
        // 👑 CHỐT SỔ: Ép máy khác đồng bộ trạng thái cuối cùng của Host
        if (typeof player.paused === "function" && !player.paused()) {
          refs.current.onPlaySync?.(time);
        } else {
          refs.current.onPauseSync?.(time);
        }
      });

      // LÀM ĐẸP CHỈ SỐ TỐC ĐỘ KHI SOFT SYNC
      let cachedRateEl: Element | null = null;

      player.on("ratechange", () => {
        if (rateAnimFrame.current) cancelAnimationFrame(rateAnimFrame.current);

        rateAnimFrame.current = requestAnimationFrame(() => {
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
        // Chặn toàn bộ logic bên dưới nếu user đang kéo thanh tua (Scrubbing/Seeking)
        // Tránh "Bão API" khi Host kéo lê chuột qua các mốc 5s, 10s, 15s...
        if (player.seeking()) return;

        const curr = player.currentTime() ?? 0;
        const dur = player.duration() ?? 0;
        const flooredCurr = Math.floor(curr);

        // 🎯 SOFT SYNC: Gọi trực tiếp từ timeupdate event (3-4 lần/giây)
        if (refs.current.isWatchParty && !refs.current.canControl) {
          runSoftSync();
        }

        // 1. LOGIC LƯU LỊCH SỬ (Mỗi 5 giây)
        if (
          flooredCurr > 0 &&
          flooredCurr % 5 === 0 &&
          flooredCurr !== lastProgressTime.current
        ) {
          lastProgressTime.current = flooredCurr;
          refs.current.onProgress(curr, dur);
        }

        // 2. 👑 LOGIC HEARTBEAT CHO WATCH PARTY (Phát sóng mỗi 10 giây)
        if (
          refs.current.isWatchParty &&
          refs.current.isHost &&
          flooredCurr > 0 &&
          flooredCurr % 10 === 0 &&
          flooredCurr !== lastHeartbeatTime.current
        ) {
          lastHeartbeatTime.current = flooredCurr;
          if (refs.current.onHeartbeatSync) {
            const isPaused =
              typeof player.paused === "function" ? player.paused() : false;
            refs.current.onHeartbeatSync(curr, isPaused);
          }
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
          // Chỉ hiện nút khi còn 15s cuối VÀ đã xem được ít nhất 10s (tránh hiện ngay khi load)
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
        // DỌN SẠCH CÁC MỐC THỜI GIAN CŨ
        targetHostTime.current = 0;
        lastSyncReceivedAt.current = Date.now();
        pendingInitialSync.current = null;
        expectedRemoteTime.current = null;
        isHostPaused.current = true;

        currentMovieSrcRef.current = movieSrc;
        isInitialSeekDone.current = false;
        lastProgressTime.current = 0;
        lastHeartbeatTime.current = 0; // Reset heartbeat time

        player.src({ src: movieSrc, type: "application/x-mpegURL" });
        player.load();

        player.one("loadedmetadata", () => {
          // QUAN TRỌNG: Trong watch party, LUÔN reset về 0 khi chuyển tập
          // Xem riêng vẫn dùng initialTime để tiếp tục từ lịch sử
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
        if (rateAnimFrame.current) cancelAnimationFrame(rateAnimFrame.current);
        player.dispose();
        playerRef.current = null;
        if (videoContainer) videoContainer.innerHTML = "";
      }
    };
  }, [
    movieSrc,
    videoRef,
    initialTime,
    isWatchParty,
    syncFromRemote,
    runSoftSync,
  ]);

  return { playerRef, syncFromRemote, getCurrentState, isSyncing };
}
