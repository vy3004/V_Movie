"use client";

import React, { useEffect, useRef, useState } from "react";
import videojs from "video.js";
import Player from "video.js/dist/types/player";
import "video.js/dist/video-js.css";
import "@videojs/themes/dist/city/index.css";
import "videojs-hotkeys";
import { MoonIcon, SunIcon } from "@heroicons/react/24/solid";

interface Props {
  movieSrc: string;
  movieName: string;
  moviePoster?: string;
  nextEpisodeSlug?: string | null;
  initialTime?: number;
  onProgress: (currentTime: number, duration: number) => void;
  onAutoNext: () => void;
}

const Button = videojs.getComponent("Button");
class NextEpisodeButton extends Button {
  constructor(player: any, options: any) {
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

  handleClick(event: any) {
    if (event) event.stopPropagation();
    const cb = (this as any).options_.onAutoNext;
    if (cb) cb();
  }
}

if (!videojs.getComponent("NextEpisodeButton")) {
  videojs.registerComponent("NextEpisodeButton", NextEpisodeButton as any);
}

export default function VideoPlayer({
  movieSrc,
  movieName,
  moviePoster,
  nextEpisodeSlug,
  initialTime = 0,
  onProgress,
  onAutoNext,
}: Props) {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const isInitialSeekDone = useRef(false);
  const [isLightsOff, setIsLightsOff] = useState(false);

  useEffect(() => {
    if (!videoRef.current || !movieSrc) return;
    isInitialSeekDone.current = false;

    const videoElement = document.createElement("video");
    videoElement.className = "video-js vjs-big-play-centered vjs-vmovie-theme";
    videoRef.current.appendChild(videoElement);

    const player = (playerRef.current = videojs(videoElement, {
      autoplay: false,
      controls: true,
      fluid: true,
      playbackRates: [0.5, 1, 1.25, 1.5, 2],
      aspectRatio: "16:9",
      sources: [{ src: movieSrc, type: "application/x-mpegURL" }],
    }));

    // Thêm nút và truyền hàm callback
    const nextBtn = player.addChild("NextEpisodeButton", { onAutoNext });
    nextBtn.hide();

    player.hotkeys({
      volumeStep: 0.1,
      seekStep: 10,
      enableVolumeScroll: false,
      alwaysCaptureHotkeys: true,
    });

    const savedVol = localStorage.getItem("movie_volume");
    if (savedVol) player.volume(Number(savedVol));

    player.on("loadedmetadata", () => {
      if (initialTime > 0 && !isInitialSeekDone.current) {
        player.currentTime(initialTime);
        isInitialSeekDone.current = true;
      }
    });

    player.on("timeupdate", () => {
      const curr = player.currentTime() ?? 0;
      const dur = player.duration() ?? 0;
      if (Math.floor(curr) % 10 === 0 && curr > 0) onProgress(curr, dur);

      // HIỆN NÚT TRONG 15S CUỐI
      if (nextEpisodeSlug && dur > 0) {
        const timeLeft = dur - curr;
        if (timeLeft <= 15 && timeLeft > 0) {
          nextBtn.show();
          // Thêm class để kích hoạt animation khi nút thực sự hiện ra
          nextBtn.addClass("is-active");
        } else {
          nextBtn.hide();
          nextBtn.removeClass("is-active");
        }
      }
    });

    player.on("ended", () => nextEpisodeSlug && onAutoNext());

    return () => {
      if (player) player.dispose();
    };
  }, [movieSrc, onAutoNext]);

  return (
    <div className="relative">
      {isLightsOff && (
        <div
          className={isLightsOff ? "fixed inset-0 bg-black/95 z-[60]" : ""}
          onClick={() => setIsLightsOff(false)}
        />
      )}
      <div className="relative z-[70] group">
        <div data-vjs-player>
          <div
            ref={videoRef}
            className="rounded-xl overflow-hidden shadow-2xl"
          />
        </div>
        <div className="flex items-center justify-between mt-4 px-2 text-white font-bold">
          <h2 className="truncate max-w-[300px]">{movieName}</h2>
          <button
            onClick={() => setIsLightsOff(!isLightsOff)}
            className={`p-2 rounded-lg ${isLightsOff ? "bg-red-600" : "bg-zinc-800/50"}`}
          >
            {isLightsOff ? (
              <SunIcon className="w-5 h-5" />
            ) : (
              <MoonIcon className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
