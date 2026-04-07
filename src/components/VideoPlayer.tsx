"use client";

import React, { useEffect, useRef, useState } from "react";
import videojs from "video.js";
import Player from "video.js/dist/types/player";
import Component from "video.js/dist/types/component";
import "video.js/dist/video-js.css";
import "@videojs/themes/dist/city/index.css";
import "videojs-hotkeys";
import { MoonIcon, SunIcon } from "@heroicons/react/24/solid";
import { useRouter } from "next/navigation";

interface Props {
  movieSrc: string;
  movieName: string;
  moviePoster?: string;
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

export default function VideoPlayer({
  movieSrc,
  movieName,
  nextEpisodeSlug,
  initialTime = 0,
  onProgress,
  onAutoNext,
  onPause,
  prevEpisodeSlug,
}: Props) {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const isInitialSeekDone = useRef(false);
  const isSeekingRef = useRef(false); 
  const mountTime = useRef(0);
  const [isLightsOff, setIsLightsOff] = useState(false);

  const router = useRouter();

  // Load autoNext preference
  const [isAutoNext, setIsAutoNext] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("v_movie_auto_next");
    return saved !== null ? saved === "true" : true;
  });

  const isAutoNextRef = useRef(isAutoNext);
  isAutoNextRef.current = isAutoNext;

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("v_movie_auto_next", String(isAutoNext));
    }
  }, [isAutoNext]);

  // Sync callbacks via refs to avoid re-initializing player
  const onProgressRef = useRef(onProgress);
  const onAutoNextRef = useRef(onAutoNext);
  const onPauseRef = useRef(onPause);
  onProgressRef.current = onProgress;
  onAutoNextRef.current = onAutoNext;
  onPauseRef.current = onPause;

  useEffect(() => {
    if (!videoRef.current || !movieSrc) return;
    mountTime.current = Date.now();

    if (!playerRef.current) {
      isInitialSeekDone.current = false;
      const videoElement = document.createElement("video");
      videoElement.className =
        "video-js vjs-big-play-centered vjs-vmovie-theme";
      videoRef.current.appendChild(videoElement);

      const player = (playerRef.current = videojs(videoElement, {
        autoplay: false,
        controls: true,
        fluid: true,
        playbackRates: [0.5, 1, 1.25, 1.5, 2],
        aspectRatio: "16:9",
        sources: [{ src: movieSrc, type: "application/x-mpegURL" }],
      }));

      const nextBtn = player.addChild("NextEpisodeButton", {
        onAutoNext: () => onAutoNextRef.current(),
      });
      nextBtn.hide();

      player.hotkeys({
        volumeStep: 0.1,
        seekStep: 10,
        enableVolumeScroll: false,
        alwaysCaptureHotkeys: true,
      });

      const savedVol = localStorage.getItem("v_movie_volume");
      if (savedVol) player.volume(Number(savedVol));

      player.on("loadedmetadata", () => {
        if (initialTime > 0 && !isInitialSeekDone.current) {
          player.currentTime(initialTime);
          isInitialSeekDone.current = true;
        }
      });

      // LOGIC CHỐNG SPAM: Theo dõi trạng thái tua
      player.on("seeking", () => {
        isSeekingRef.current = true;
      });
      player.on("seeked", () => {
        isSeekingRef.current = false;
      });

      player.on("timeupdate", () => {
        const curr = player.currentTime() ?? 0;
        const dur = player.duration() ?? 0;

        // Chỉ gửi progress mỗi khi giây thay đổi đáng kể (tránh spam)
        if (Math.floor(curr) % 5 === 0 && curr > 0) {
          onProgressRef.current(curr, dur);
        }

        if (nextEpisodeSlug && dur > 0 && isAutoNextRef.current) {
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
        if (nextEpisodeSlug && isAutoNextRef.current) {
          onAutoNextRef.current();
        }
      });

      player.on("pause", () => {
        // QUAN TRỌNG: Chỉ trigger pause sync khi KHÔNG phải đang tua
        if (!isSeekingRef.current) {
          onPauseRef.current?.();
        }
      });

      player.on("volumechange", () => {
        localStorage.setItem("v_movie_volume", String(player.volume()));
      });
    } else {
      const player = playerRef.current;
      if (player.currentSrc() !== movieSrc) {
        isInitialSeekDone.current = false;
        player.src({ src: movieSrc, type: "application/x-mpegURL" });
        player.load();
      } else if (initialTime > 0 && !isInitialSeekDone.current) {
        player.currentTime(initialTime);
        isInitialSeekDone.current = true;
      }
    }
  }, [movieSrc, initialTime, nextEpisodeSlug]);

  useEffect(() => {
    return () => {
      const timeSinceMount = Date.now() - mountTime.current;
      if (timeSinceMount < 100) return;
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative">
      {isLightsOff && (
        <div
          className="fixed inset-0 bg-black/95 z-[60]"
          onClick={() => setIsLightsOff(false)}
        />
      )}

      <h2 className="text-lg font-bold text-white mb-3 truncate">
        {movieName}
      </h2>

      <div
        className={`${isLightsOff ? "relative z-[999]" : ""} bg-background rounded-xl overflow-hidden border border-zinc-800 backdrop-blur-md`}
      >
        <div data-vjs-player>
          <div ref={videoRef} />
        </div>

        {/* Controls bar below video - hugs the video */}
        <div className="flex items-center justify-center gap-3 sm:gap-4 mt-0 -mb-2 py-3 px-3 sm:px-4 rounded-b-xl">
          {/* Favorite button */}
           <button className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-300 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-4 h-4 sm:w-5 sm:h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
              />
            </svg>
            <span className="hidden md:inline">Theo dõi</span>
          </button>

          {/* Rating button */}
          <button className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-300 hover:text-yellow-400 hover:bg-zinc-800 rounded-lg transition">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-4 h-4 sm:w-5 sm:h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
              />
            </svg>
            <span className="hidden md:inline">Đánh giá</span>
          </button>

          {/* Comment button */}
          <button className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-300 hover:text-blue-500 hover:bg-zinc-800 rounded-lg transition">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-4 h-4 sm:w-5 sm:h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
              />
            </svg>
            <span className="hidden md:inline">Bình luận</span>
          </button>

          {/* Chuyển tập auto toggle */}
          <button
            onClick={() => setIsAutoNext(!isAutoNext)}
            className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg transition ${isAutoNext ? "text-green-400 hover:bg-zinc-800" : "text-gray-500 hover:bg-zinc-800"}`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-4 h-4 sm:w-5 sm:h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
              />
            </svg>
            <span className="hidden md:inline">Chuyển tập</span>
            <span className="md:hidden text-[10px] font-bold">
              {isAutoNext ? "ON" : "OFF"}
            </span>
          </button>

          {/* Prev/Next buttons */}
          <button
            onClick={() =>
              prevEpisodeSlug &&
              router.push(`?tap=${prevEpisodeSlug}#video`, { scroll: false })
            }
            disabled={!prevEpisodeSlug}
            className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-sm transition rounded-lg ${prevEpisodeSlug ? "text-gray-300 hover:text-white hover:bg-zinc-800" : "text-gray-600 cursor-not-allowed"}`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-5 h-5 sm:w-6 sm:h-6"
            >
              <polygon points="14.5,3 7,12 14.5,21" />
            </svg>
          </button>

          <button
            onClick={() =>
              nextEpisodeSlug &&
              router.push(`?tap=${nextEpisodeSlug}#video`, { scroll: false })
            }
            disabled={!nextEpisodeSlug}
            className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-sm transition rounded-lg ${nextEpisodeSlug ? "text-gray-300 hover:text-white hover:bg-zinc-800" : "text-gray-600 cursor-not-allowed"}`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-5 h-5 sm:w-6 sm:h-6"
            >
              <polygon points="9.5,3 17,12 9.5,21" />
            </svg>
          </button>

          {/* Tắt đèn toggle */}
          <button
            onClick={() => setIsLightsOff(!isLightsOff)}
            className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-300 hover:text-white hover:bg-zinc-800 rounded-lg transition"
          >
            {isLightsOff ? (
              <SunIcon className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
            ) : (
              <MoonIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
