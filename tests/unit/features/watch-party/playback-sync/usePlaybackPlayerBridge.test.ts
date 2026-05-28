import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePlaybackPlayerBridge } from "@/features/watch-party/playback-sync";

type FakePlayer = {
  currentTime: ReturnType<typeof vi.fn>;
  paused: ReturnType<typeof vi.fn>;
  playbackRate: ReturnType<typeof vi.fn>;
  seeking: ReturnType<typeof vi.fn>;
  readyState: ReturnType<typeof vi.fn>;
  isDisposed: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
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
    playbackRate: vi.fn(),
    seeking: vi.fn(() => false),
    readyState: vi.fn(() => 4),
    isDisposed: vi.fn(() => false),
    play: vi.fn(() => {
      paused = false;
      return Promise.resolve();
    }),
    pause: vi.fn(() => {
      paused = true;
    }),
  } satisfies FakePlayer;
};

describe("usePlaybackPlayerBridge", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does not send seek command after remote seek without user intent", () => {
    const player = createPlayer();
    const onSeekSync = vi.fn();

    const { result } = renderHook(() =>
      usePlaybackPlayerBridge({
        isWatchParty: true,
        canControl: true,
        isHost: false,
        getPlayer: () => player as never,
        onSeekSync,
      }),
    );

    act(() => {
      result.current.syncFromRemote("seek", 45);
      vi.advanceTimersByTime(2100);
      result.current.commitNetworkSync("seek");
      vi.advanceTimersByTime(300);
    });

    expect(onSeekSync).not.toHaveBeenCalled();
  });

  it("updates local sync target on local seek so soft-sync does not pull controller back", () => {
    const player = createPlayer();
    const onSeekSync = vi.fn();

    const { result } = renderHook(() =>
      usePlaybackPlayerBridge({
        isWatchParty: true,
        canControl: true,
        isHost: false,
        getPlayer: () => player as never,
        onSeekSync,
      }),
    );

    act(() => {
      result.current.syncFromRemote("play", 10);
      player.currentTime.mockClear();
      result.current.markUserIntent();
      player.currentTime(60);
      result.current.commitNetworkSync("seek");
      vi.advanceTimersByTime(6100);
      result.current.runSoftSync();
    });

    const lowerSeek = player.currentTime.mock.calls.find(
      ([time]) => typeof time === "number" && time < 50,
    );
    expect(lowerSeek).toBeUndefined();
    expect(onSeekSync).toHaveBeenCalledWith(60);
  });
});
