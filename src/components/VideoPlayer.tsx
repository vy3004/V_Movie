"use client";

import React, { useState, useRef, useEffect } from "react";
import videojs from "video.js";
import Player from "video.js/dist/types/player";
import Component from "video.js/dist/types/component";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useVideoPlayer } from "@/hooks/useVideoPlayer";
import { useSubscription } from "@/hooks/useSubscription";
import { Movie } from "@/lib/types";
import VideoControls from "@/components/VideoControls";

interface Props {
  user: User | null | undefined;
  movie: Movie;
  movieSrc: string;
  movieName: string;
  nextEpisodeSlug?: string | null;
  prevEpisodeSlug?: string | null;
  initialTime?: number;
  onProgress: (currentTime: number, duration: number) => void;
  onAutoNext: () => void;
  onPause?: () => void;
}

interface NextEpisodeOptions {
  className?: string;
  children?: unknown[];
  onAutoNext?: () => void;
}

// Định nghĩa class Button của VideoJS
const Button = videojs.getComponent("Button");
class NextEpisodeButton extends Button {
  constructor(player: Player, options: NextEpisodeOptions) {
    super(player, options);
    this.addClass("vjs-next-overlay-btn");

    this.el().innerHTML = `
      <div class="next-btn-fill-bar"></div>
      <div class="next-btn-inner-content">
        <span>Tập tiếp theo</span>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-5">
          <path stroke-linecap="round" stroke-linejoin="round" d="m5.25 4.5 7.5 7.5-7.5 7.5m6-15 7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    `;
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

export default function VideoPlayer(props: Props) {
  const videoRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [isLightsOff, setIsLightsOff] = useState(false);
  const [isAutoNext, setIsAutoNext] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("v_movie_auto_next") !== "false";
  });

  // 1. Logic Theo dõi
  const {
    isFollowed,
    toggleFollow,
    isLoading: isFollowLoading,
  } = useSubscription({
    user: props.user,
    movie: props.movie,
  });

  // 2. Logic Player
  useVideoPlayer({
    videoRef,
    movieSrc: props.movieSrc,
    initialTime: props.initialTime || 0,
    nextEpisodeSlug: props.nextEpisodeSlug,
    isAutoNext,
    onProgress: props.onProgress,
    onAutoNext: props.onAutoNext,
    onPause: props.onPause,
  });

  // Lưu cấu hình AutoNext
  useEffect(() => {
    localStorage.setItem("v_movie_auto_next", String(isAutoNext));
  }, [isAutoNext]);

  return (
    <div className="relative">
      {isLightsOff && (
        <div
          className="fixed inset-0 bg-black/95 z-[60]"
          onClick={() => setIsLightsOff(false)}
        />
      )}
      <h2 className="text-lg font-bold text-white mb-3 truncate">
        {props.movieName}
      </h2>

      <div
        className={`${isLightsOff ? "relative z-[999]" : ""} bg-background rounded-xl overflow-hidden border border-zinc-800 backdrop-blur-md`}
      >
        <div data-vjs-player>
          <div ref={videoRef} />
        </div>

        <VideoControls
          isFollowed={isFollowed}
          isFollowLoading={isFollowLoading}
          toggleFollow={toggleFollow}
          isAutoNext={isAutoNext}
          setIsAutoNext={setIsAutoNext}
          isLightsOff={isLightsOff}
          setIsLightsOff={setIsLightsOff}
          onPrev={() =>
            props.prevEpisodeSlug &&
            router.push(`?tap=${props.prevEpisodeSlug}#video`, {
              scroll: false,
            })
          }
          onNext={() =>
            props.nextEpisodeSlug &&
            router.push(`?tap=${props.nextEpisodeSlug}#video`, {
              scroll: false,
            })
          }
          prevEnabled={!!props.prevEpisodeSlug}
          nextEnabled={!!props.nextEpisodeSlug}
        />
      </div>
    </div>
  );
}
