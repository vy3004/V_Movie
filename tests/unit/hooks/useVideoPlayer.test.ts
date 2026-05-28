/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVideoPlayer } from "@/hooks/useVideoPlayer";
import type { PlayerSyncRef } from "@/types";

const handlers = new Map<string, Array<() => void>>();
let player: any;

vi.mock("sonner", () => ({
  toast: { info: vi.fn() },
}));

vi.mock("videojs-hotkeys", () => ({}));
vi.mock("video.js/dist/video-js.css", () => ({}));
vi.mock("@videojs/themes/dist/city/index.css", () => ({}));

vi.mock("video.js", () => {
  const videojs = vi.fn(() => player);
  return { default: videojs };
});

const emit = (event: string) => {
  for (const handler of handlers.get(event) ?? []) handler();
};

const createPlayer = () => {
  let time = 0;
  let paused = true;

  return {
    currentTime: vi.fn((next?: number) => {
      if (typeof next === "number") time = next;
      return time;
    }),
    paused: vi.fn(() => paused),
    play: vi.fn(() => {
      paused = false;
      return Promise.resolve();
    }),
    pause: vi.fn(() => {
      paused = true;
    }),
    playbackRate: vi.fn(),
    readyState: vi.fn(() => 4),
    seeking: vi.fn(() => false),
    isDisposed: vi.fn(() => false),
    dispose: vi.fn(),
    on: vi.fn((event: string, handler: () => void) => {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
      return player;
    }),
    one: vi.fn((event: string, handler: () => void) => {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
      return player;
    }),
    addChild: vi.fn(() => ({ hide: vi.fn(), addClass: vi.fn(), removeClass: vi.fn() })),
    hotkeys: vi.fn(),
    tech: vi.fn(() => ({ el: () => ({ preservesPitch: false }) })),
    el: vi.fn(() => document.createElement("div")),
    src: vi.fn(),
    load: vi.fn(),
    duration: vi.fn(() => 100),
    isFullscreen: vi.fn(() => false),
  };
};

describe("useVideoPlayer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    handlers.clear();
    player = createPlayer();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    vi.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does not pull non-host controller back after local seek", () => {
    const videoRef = { current: document.createElement("div") };
    const playerSyncRef: { current: PlayerSyncRef | null } = { current: null };
    const playerEl = document.createElement("div");
    player.el.mockReturnValue(playerEl);

    renderHook(() =>
      useVideoPlayer({
        videoRef,
        movieSrc: "https://example.com/video.m3u8",
        initialTime: 10,
        isAutoNext: false,
        onProgress: vi.fn(),
        onAutoNext: vi.fn(),
        isWatchParty: true,
        canControl: true,
        isHost: false,
        onSeekSync: vi.fn(),
        playerSyncRef,
      }),
    );

    act(() => {
      emit("loadedmetadata");
      playerSyncRef.current?.syncFromRemote("play", 10);
    });
    player.currentTime.mockClear();

    act(() => {
      playerEl.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      player.currentTime(60);
      emit("seeked");
      vi.advanceTimersByTime(6100);
      emit("timeupdate");
    });

    const lowerSeek = player.currentTime.mock.calls.find(
      ([time]: [unknown]) => typeof time === "number" && time < 50,
    );
    expect(lowerSeek).toBeUndefined();
  });

  it("does not send seek control after remote seek without user intent", () => {
    const videoRef = { current: document.createElement("div") };
    const playerSyncRef: { current: PlayerSyncRef | null } = { current: null };
    const onSeekSync = vi.fn();

    renderHook(() =>
      useVideoPlayer({
        videoRef,
        movieSrc: "https://example.com/video.m3u8",
        initialTime: 0,
        isAutoNext: false,
        onProgress: vi.fn(),
        onAutoNext: vi.fn(),
        isWatchParty: true,
        canControl: true,
        onSeekSync,
        playerSyncRef,
      }),
    );

    act(() => {
      emit("loadedmetadata");
      playerSyncRef.current?.syncFromRemote("seek", 45);
      vi.advanceTimersByTime(2100);
      emit("seeking");
      emit("seeked");
      vi.advanceTimersByTime(300);
    });

    expect(onSeekSync).not.toHaveBeenCalled();
  });

  it("keeps the same player when callback identity changes", () => {
    const videoRef = { current: document.createElement("div") };
    const firstProgress = vi.fn();
    const secondProgress = vi.fn();

    const { rerender } = renderHook(
      ({ onProgress }) =>
        useVideoPlayer({
          videoRef,
          movieSrc: "https://example.com/video.m3u8",
          initialTime: 0,
          isAutoNext: false,
          onProgress,
          onAutoNext: vi.fn(),
          isWatchParty: true,
          canControl: true,
        }),
      { initialProps: { onProgress: firstProgress } },
    );

    rerender({ onProgress: secondProgress });

    expect(player.dispose).not.toHaveBeenCalled();
  });
});
