"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import NProgress from "nprogress";
import { createPortal } from "react-dom";
import videojs from "video.js";
import Player from "video.js/dist/types/player";
import Component from "video.js/dist/types/component";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useVideoPlayer } from "@/hooks/useVideoPlayer";
import { useSubscriptionAction } from "@/hooks/useSubscription";
import { Movie, PlayerSyncRef } from "@/types";
import VideoControls from "@/components/shared/VideoControls";
import AudioDuckingManager from "@/app/(main)/xem-chung/_components/AudioDuckingManager";

interface Props {
  user: User | null | undefined;
  movie: Movie;
  movieSrc: string;
  nextEpisodeSlug?: string | null;
  prevEpisodeSlug?: string | null;
  initialTime?: number;
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
  onPlayerReady?: () => void;
  onManualSync?: () => void;
  playerSyncRef?: React.MutableRefObject<PlayerSyncRef | null>;
  onChangeEpisode?: (slug: string) => void;
  children?: React.ReactNode;
}

interface NextEpisodeOptions {
  className?: string;
  children?: unknown[];
  onAutoNext?: () => void;
}

// --------------------------------------------------------------------------
// KHỞI TẠO NÚT "TẬP TIẾP THEO" CHO VIDEO.JS
// --------------------------------------------------------------------------
const Button = videojs.getComponent("Button");
class NextEpisodeButton extends Button {
  constructor(player: Player, options: NextEpisodeOptions) {
    super(player, options);
    this.addClass("vjs-next-overlay-btn");
    this.el().innerHTML = `<div class="next-btn-fill-bar"></div><div class="next-btn-inner-content"><span>Tập tiếp theo</span><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-5"><path stroke-linecap="round" stroke-linejoin="round" d="m5.25 4.5 7.5 7.5-7.5 7.5m6-15 7.5 7.5-7.5 7.5" /></svg></div>`;
  }
  handleClick(event: Event) {
    if (event) event.stopPropagation();
    const options = (this as unknown as { options_: NextEpisodeOptions })
      .options_;
    const cb = options?.onAutoNext;
    if (cb) cb();
  }
}
if (!videojs.getComponent("NextEpisodeButton")) {
  videojs.registerComponent(
    "NextEpisodeButton",
    NextEpisodeButton as unknown as typeof Component,
  );
}

// --------------------------------------------------------------------------
// COMPONENT CHÍNH: VIDEO PLAYER
// --------------------------------------------------------------------------
function VideoPlayer(props: Props) {
  const videoRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // STATE GIAO DIỆN & CẤU HÌNH
  const [isLightsOff, setIsLightsOff] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playerNode, setPlayerNode] = useState<Element | null>(null);
  const [isAutoNext, setIsAutoNext] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("v_movie_auto_next") !== "false";
  });
  const [playerInstance, setPlayerInstance] = useState<Player | null>(null);
  const [isReady, setIsReady] = useState(false);

  // REFS ĐỂ ĐẢM BẢO HOOK KHÔNG BỊ STALE DATA LÚC ĐỒNG BỘ
  const onPlaySyncRef = useRef(props.onPlaySync);
  const onPauseSyncRef = useRef(props.onPauseSync);
  const onSeekSyncRef = useRef(props.onSeekSync);
  const onHeartbeatSyncRef = useRef(props.onHeartbeatSync);

  useEffect(() => {
    onPlaySyncRef.current = props.onPlaySync;
    onPauseSyncRef.current = props.onPauseSync;
    onSeekSyncRef.current = props.onSeekSync;
    onHeartbeatSyncRef.current = props.onHeartbeatSync;
  }, [props.onPlaySync, props.onPauseSync, props.onSeekSync, props.onHeartbeatSync]);

  // XỬ LÝ SỰ KIỆN FULLSCREEN CỦA TRÌNH DUYỆT
  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element };
      const fullscreenEl = doc.fullscreenElement || doc.webkitFullscreenElement;

      const isFull = !!(
        fullscreenEl && videoRef.current?.contains(fullscreenEl)
      );
      setIsFullscreen(isFull);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange,
      );
    };
  }, []);

  // CÁC HÀM GỬI TÍN HIỆU ĐỒNG BỘ
  const handlePlaySync = useCallback((time: number) => {
    onPlaySyncRef.current?.(time);
  }, []);

  const handlePauseSync = useCallback((time: number) => {
    onPauseSyncRef.current?.(time);
  }, []);

  const handleSeekSync = useCallback((time: number) => {
    onSeekSyncRef.current?.(time);
  }, []);

  const handleHeartbeatSync = useCallback((time: number, isPaused: boolean) => {
    onHeartbeatSyncRef.current?.(time, isPaused);
  }, []);

  const { onPlayerReady, isWatchParty, canControl } = props;

  // LƯU LẠI INSTANCE CỦA TRÌNH PHÁT KHI KHỞI TẠO XONG
  const handlePlayerReady = useCallback(() => {
    if (videoRef.current) {
      const node = videoRef.current.querySelector(".video-js");
      if (node) setPlayerNode(node);
    }

    // Chỉ phất cờ báo hiệu video đã load xong, không gọi trực tiếp playerRef ở đây
    setIsReady(true);

    if (onPlayerReady) onPlayerReady();
  }, [onPlayerReady]);

  // HOOKS LOGIC
  const {
    isFollowed,
    toggleFollow,
    isLoading: isFollowLoading,
  } = useSubscriptionAction({
    user: props.user,
    movie: props.movie,
  });

  const { playerRef, syncFromRemote, syncHeartbeat, getCurrentState, isSyncing } =
    useVideoPlayer({
      videoRef,
      movieSrc: props.movieSrc,
      initialTime: props.initialTime || 0,
      nextEpisodeSlug: props.nextEpisodeSlug,
      isAutoNext,
      onProgress: props.onProgress,
      onAutoNext: props.onAutoNext,
      onPause: props.onPause,
      isWatchParty: props.isWatchParty,
      canControl: props.canControl,
      isHost: props.isHost,
      onPlaySync: handlePlaySync,
      onPauseSync: handlePauseSync,
      onSeekSync: handleSeekSync,
      onHeartbeatSync: handleHeartbeatSync,
      onPlayerReady: handlePlayerReady,
    });

  // ĐỒNG BỘ PLAYER INSTANCE KHI CỜ ISREADY ĐƯỢC PHẤT (GIÚP AUDIODUCKING CHẠY ĐÚNG)
  useEffect(() => {
    if (isReady && playerRef.current) {
      setPlayerInstance(playerRef.current);
    }
  }, [isReady, playerRef]);

  // XUẤT HÀM ĐỒNG BỘ RA NGOÀI CHO REALTIME SỬ DỤNG
  useEffect(() => {
    if (props.playerSyncRef) {
      props.playerSyncRef.current = {
        syncFromRemote,
        syncHeartbeat,
        getCurrentState,
      };
    }
  }, [syncFromRemote, syncHeartbeat, getCurrentState, props.playerSyncRef]);

  // LƯU CẤU HÌNH AUTO-NEXT
  useEffect(() => {
    localStorage.setItem("v_movie_auto_next", String(isAutoNext));
  }, [isAutoNext]);

  // KHÓA BÀN PHÍM ĐỐI VỚI KHÁCH TRONG WATCH PARTY
  const handleKeyDownCapture = useCallback(
    (e: React.KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return;
      }

      if (isWatchParty && !canControl) {
        const blockedKeys = [
          " ",
          "Spacebar",
          "ArrowLeft",
          "ArrowRight",
          "MediaPlayPause",
          "MediaTrackNext",
          "MediaTrackPrevious",
        ];
        if (blockedKeys.includes(e.key)) {
          e.preventDefault();
          e.stopPropagation();
          toast.warning("Bạn đang ở chế độ Khách, không thể dùng phím tắt!", {
            id: "guest-keyboard-lock",
          });
        }
      }
    },
    [isWatchParty, canControl],
  );

  // CSS KHÓA CHUỘT CHO KHÁCH
  const guestModeClasses =
    !props.canControl && props.isWatchParty
      ? [
          "[&_.vjs-tech]:pointer-events-none", // Khóa click trực tiếp vào video
          "[&_.vjs-play-control]:pointer-events-none [&_.vjs-play-control]:opacity-50", // Khóa nút Play nhỏ
          "[&_.vjs-progress-control]:pointer-events-none [&_.vjs-progress-control]:opacity-50", // Khóa tua video
          "[&_.vjs-big-play-button]:pointer-events-none [&_.vjs-big-play-button]:opacity-50", // KHÓA NÚT PLAY KHỔNG LỒ
        ].join(" ")
      : "";

  return (
    <div className="relative">
      {/* MODULE AUTO DUCKING (GIẢM ÂM LƯỢNG KHI CÓ NGƯỜI NÓI) */}
      {props.isWatchParty && playerInstance && (
        <AudioDuckingManager player={playerInstance} />
      )}

      {/* TẮT ĐÈN OVERLAY */}
      {isLightsOff && (
        <div
          className="fixed inset-0 bg-black/95 z-[60]"
          onClick={() => setIsLightsOff(false)}
        />
      )}

      {/* CONTAINER CHÍNH */}
      <div
        className={`${
          isLightsOff ? "relative z-[999]" : ""
        } bg-background rounded-xl overflow-hidden border border-zinc-800 backdrop-blur-md`}
      >
        {/* OVERLAY ĐANG ĐỒNG BỘ */}
        {isSyncing && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-red-600/30 border-t-red-600 rounded-full animate-spin shadow-[0_0_15px_rgba(220,38,38,0.5)]" />
              <p className="text-white font-bold tracking-[0.2em] uppercase text-xs animate-pulse">
                Đang đồng bộ máy chủ...
              </p>
            </div>
          </div>
        )}

        {/* TRÌNH PHÁT VIDEO */}
        <div
          data-vjs-player
          className={guestModeClasses}
          onKeyDownCapture={handleKeyDownCapture}
        >
          <div ref={videoRef} />

          {/* PORTAL CHO CÁC ELEMENT BÊN TRONG VIDEO KHI FULLSCREEN (NHƯ CHAT) */}
          {playerNode &&
            isFullscreen &&
            props.children &&
            createPortal(
              <div className="absolute inset-0 z-[100] pointer-events-none overflow-hidden">
                {props.children}
              </div>,
              playerNode,
            )}
        </div>

        {/* THANH ĐIỀU KHIỂN BÊN DƯỚI VIDEO */}
        <VideoControls
          isFollowed={isFollowed}
          isFollowLoading={isFollowLoading}
          toggleFollow={toggleFollow}
          isAutoNext={isAutoNext}
          setIsAutoNext={setIsAutoNext}
          isLightsOff={isLightsOff}
          setIsLightsOff={setIsLightsOff}
          isWatchParty={props.isWatchParty}
          onManualSync={props.onManualSync}
          onPrev={() => {
            if (!props.prevEpisodeSlug) return;
            if (props.isWatchParty) {
              if (props.canControl && props.onChangeEpisode) {
                props.onChangeEpisode(props.prevEpisodeSlug);
              }
            } else {
              NProgress.start();
              router.push(`?tap=${props.prevEpisodeSlug}#video`, {
                scroll: false,
              });
            }
          }}
          onNext={() => {
            if (!props.nextEpisodeSlug) return;
            if (props.isWatchParty) {
              if (props.canControl && props.onChangeEpisode) {
                props.onChangeEpisode(props.nextEpisodeSlug);
              }
            } else {
              NProgress.start();
              router.push(`?tap=${props.nextEpisodeSlug}#video`, {
                scroll: false,
              });
            }
          }}
          prevEnabled={
            !!props.prevEpisodeSlug &&
            (!props.isWatchParty || !!props.canControl)
          }
          nextEnabled={
            !!props.nextEpisodeSlug &&
            (!props.isWatchParty || !!props.canControl)
          }
        />
      </div>
    </div>
  );
}

export default VideoPlayer;
