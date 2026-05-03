/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useVideoControl } from "@/app/(main)/xem-chung/_hooks/useVideoControl";
import React from "react";

// Mock Supabase
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
  send: vi.fn().mockResolvedValue({ error: null }),
  track: vi.fn().mockResolvedValue({ error: null }),
  untrack: vi.fn().mockResolvedValue({ error: null }),
  state: "joined",
};

const mockSupabase = {
  channel: vi.fn().mockReturnValue(mockChannel),
  removeChannel: vi.fn(),
} as any;

// Mock fetch
global.fetch = vi.fn();

describe("useVideoControl", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock fetch for initial room query
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/watch-party?roomId=')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            room: { id: 'room-123', room_code: 'ABC123' },
            state: { status: 'pause', time: 0 }
          })
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  describe("Broadcast", () => {
    it("should send broadcast immediately when sendControl is called", async () => {
      const syncFromRemote = vi.fn();
      const { result } = renderHook(
        () =>
          useVideoControl(
            "room-123",
            "user-1",
            true,
            mockSupabase,
            syncFromRemote,
          ),
        { wrapper },
      );

      await waitFor(() => expect(result.current.sendControl).toBeDefined());

      // Call sendControl
      result.current.sendControl("play", 10.5);

      // Verify broadcast sent immediately
      expect(mockChannel.send).toHaveBeenCalledWith({
        type: "broadcast",
        event: "video_control",
        payload: {
          action: "play",
          time: 10.5,
          episodeSlug: undefined,
          senderId: "user-1",
        },
      });
    });

    it("should not send broadcast when user has no control permission", async () => {
      const syncFromRemote = vi.fn();
      const { result } = renderHook(
        () =>
          useVideoControl(
            "room-123",
            "user-1",
            false, // canControl = false
            mockSupabase,
            syncFromRemote,
          ),
        { wrapper },
      );

      await waitFor(() => expect(result.current.sendControl).toBeDefined());

      result.current.sendControl("play", 10.5);

      // Should not send broadcast
      expect(mockChannel.send).not.toHaveBeenCalled();
    });

    it("should include episodeSlug in broadcast when provided", async () => {
      const syncFromRemote = vi.fn();
      const { result } = renderHook(
        () =>
          useVideoControl(
            "room-123",
            "user-1",
            true,
            mockSupabase,
            syncFromRemote,
          ),
        { wrapper },
      );

      await waitFor(() => expect(result.current.sendControl).toBeDefined());

      result.current.sendControl("play", 0, "tap-1");

      expect(mockChannel.send).toHaveBeenCalledWith({
        type: "broadcast",
        event: "video_control",
        payload: {
          action: "play",
          time: 0,
          episodeSlug: "tap-1",
          senderId: "user-1",
        },
      });
    });
  });

  describe("Debounced API Sync", () => {
    it("should debounce API calls with 200ms delay", async () => {
      (global.fetch as any).mockResolvedValue({ ok: true });

      const syncFromRemote = vi.fn();
      const { result } = renderHook(
        () =>
          useVideoControl(
            "room-123",
            "user-1",
            true,
            mockSupabase,
            syncFromRemote,
          ),
        { wrapper },
      );

      await waitFor(() => expect(result.current.sendControl).toBeDefined());

      // Call sendControl multiple times rapidly
      result.current.sendControl("play", 1);
      result.current.sendControl("play", 2);
      result.current.sendControl("play", 3);

      // API should not be called yet
      expect(global.fetch).not.toHaveBeenCalled();

      // Fast-forward 200ms
      vi.advanceTimersByTime(200);

      // Now API should be called once with the last value
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/watch-party/sync",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({
              roomId: "room-123",
              status: "play",
              time: 3,
              episodeSlug: undefined,
            }),
          }),
        );
      });
    });

    it("should use trailing edge of debounce", async () => {
      (global.fetch as any).mockResolvedValue({ ok: true });

      const syncFromRemote = vi.fn();
      const { result } = renderHook(
        () =>
          useVideoControl(
            "room-123",
            "user-1",
            true,
            mockSupabase,
            syncFromRemote,
          ),
        { wrapper },
      );

      await waitFor(() => expect(result.current.sendControl).toBeDefined());

      // Call at t=0
      result.current.sendControl("play", 1);

      // Should not call immediately (leading: false)
      expect(global.fetch).not.toHaveBeenCalled();

      // Call again at t=200ms
      vi.advanceTimersByTime(200);
      result.current.sendControl("play", 2);

      // Still no call
      expect(global.fetch).not.toHaveBeenCalled();

      // Wait 200ms from last call
      vi.advanceTimersByTime(200);

      // Now should call with last value
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/watch-party/sync",
          expect.objectContaining({
            body: JSON.stringify({
              roomId: "room-123",
              status: "play",
              time: 2,
              episodeSlug: undefined,
            }),
          }),
        );
      });
    });

    it("should not send API call when user has no control permission", async () => {
      (global.fetch as any).mockResolvedValue({ ok: true });

      const syncFromRemote = vi.fn();
      const { result } = renderHook(
        () =>
          useVideoControl(
            "room-123",
            "user-1",
            false, // canControl = false
            mockSupabase,
            syncFromRemote,
          ),
        { wrapper },
      );

      await waitFor(() => expect(result.current.sendControl).toBeDefined());

      result.current.sendControl("play", 10);
      vi.advanceTimersByTime(200);

      await waitFor(() => {
        expect(global.fetch).not.toHaveBeenCalled();
      });
    });

    it("should set status to undefined for seek action", async () => {
      (global.fetch as any).mockResolvedValue({ ok: true });

      const syncFromRemote = vi.fn();
      const { result } = renderHook(
        () =>
          useVideoControl(
            "room-123",
            "user-1",
            true,
            mockSupabase,
            syncFromRemote,
          ),
        { wrapper },
      );

      await waitFor(() => expect(result.current.sendControl).toBeDefined());

      result.current.sendControl("seek", 50);
      vi.advanceTimersByTime(200);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/watch-party/sync",
          expect.objectContaining({
            body: JSON.stringify({
              roomId: "room-123",
              status: undefined, // seek doesn't change play/pause status
              time: 50,
              episodeSlug: undefined,
            }),
          }),
        );
      });
    });
  });

  describe("Throttled Seek Broadcast", () => {
    it("should throttle seek broadcasts to max 10 times/second", async () => {
      const syncFromRemote = vi.fn();
      const { result } = renderHook(
        () =>
          useVideoControl(
            "room-123",
            "user-1",
            true,
            mockSupabase,
            syncFromRemote,
          ),
        { wrapper },
      );

      await waitFor(() => expect(result.current.sendControl).toBeDefined());

      // Simulate user dragging seek bar (60fps = 16.67ms per frame)
      for (let i = 0; i < 20; i++) {
        result.current.sendControl("seek", i);
        vi.advanceTimersByTime(16.67);
      }

      // With 100ms throttle, in 333ms (20 frames) we should have max 4 broadcasts
      // (leading + 2 intermediate + trailing)
      await waitFor(() => {
        const seekCalls = (mockChannel.send as any).mock.calls.filter(
          (call: any) => call[0]?.payload?.action === "seek"
        );
        expect(seekCalls.length).toBeLessThanOrEqual(5);
        expect(seekCalls.length).toBeGreaterThanOrEqual(3);
      });
    });

    it("should NOT throttle play/pause broadcasts", async () => {
      const syncFromRemote = vi.fn();
      const { result } = renderHook(
        () =>
          useVideoControl(
            "room-123",
            "user-1",
            true,
            mockSupabase,
            syncFromRemote,
          ),
        { wrapper },
      );

      await waitFor(() => expect(result.current.sendControl).toBeDefined());

      // Call play/pause rapidly
      result.current.sendControl("play", 1);
      vi.advanceTimersByTime(50);
      result.current.sendControl("pause", 1);
      vi.advanceTimersByTime(50);
      result.current.sendControl("play", 1);

      // All play/pause should be sent immediately (not throttled)
      await waitFor(() => {
        const playCalls = (mockChannel.send as any).mock.calls.filter(
          (call: any) => call[0]?.payload?.action === "play"
        );
        const pauseCalls = (mockChannel.send as any).mock.calls.filter(
          (call: any) => call[0]?.payload?.action === "pause"
        );
        expect(playCalls.length).toBe(2);
        expect(pauseCalls.length).toBe(1);
      });
    });
  });

  describe("Realtime Channel", () => {
    it("should setup channel with correct config", async () => {
      const syncFromRemote = vi.fn();
      renderHook(
        () =>
          useVideoControl(
            "room-123",
            "user-1",
            true,
            mockSupabase,
            syncFromRemote,
          ),
        { wrapper },
      );

      await waitFor(() => {
        expect(mockSupabase.channel).toHaveBeenCalledWith("wp_video_room-123", {
          config: {
            presence: { key: "room-123" },
            broadcast: { ack: false, self: false },
          },
        });
      });
    });

    it("should listen for video_control events", async () => {
      const syncFromRemote = vi.fn();
      renderHook(
        () =>
          useVideoControl(
            "room-123",
            "user-1",
            true,
            mockSupabase,
            syncFromRemote,
          ),
        { wrapper },
      );

      await waitFor(() => {
        expect(mockChannel.on).toHaveBeenCalledWith(
          "broadcast",
          { event: "video_control" },
          expect.any(Function),
        );
      });
    });

    it("should call syncFromRemote when receiving broadcast", async () => {
      const syncFromRemote = vi.fn();
      let broadcastHandler: any;

      mockChannel.on.mockImplementation((type, config, handler) => {
        if (config.event === "video_control") {
          broadcastHandler = handler;
        }
        return mockChannel;
      });

      renderHook(
        () =>
          useVideoControl(
            "room-123",
            "user-1",
            true,
            mockSupabase,
            syncFromRemote,
          ),
        { wrapper },
      );

      await waitFor(() => expect(broadcastHandler).toBeDefined());

      // Simulate receiving broadcast
      broadcastHandler({
        payload: {
          action: "play",
          time: 15.5,
          senderId: "user-2", // different user
        },
      });

      expect(syncFromRemote).toHaveBeenCalledWith("play", 15.5, undefined);
    });

    it("should ignore broadcast from self", async () => {
      const syncFromRemote = vi.fn();
      let broadcastHandler: any;

      mockChannel.on.mockImplementation((type, config, handler) => {
        if (config.event === "video_control") {
          broadcastHandler = handler;
        }
        return mockChannel;
      });

      renderHook(
        () =>
          useVideoControl(
            "room-123",
            "user-1",
            true,
            mockSupabase,
            syncFromRemote,
          ),
        { wrapper },
      );

      await waitFor(() => expect(broadcastHandler).toBeDefined());

      // Simulate receiving broadcast from self
      broadcastHandler({
        payload: {
          action: "play",
          time: 15.5,
          senderId: "user-1", // same user
        },
      });

      expect(syncFromRemote).not.toHaveBeenCalled();
    });

    it("should call onChangeEpisode when episodeSlug is in payload", async () => {
      const syncFromRemote = vi.fn();
      const onChangeEpisode = vi.fn();
      let broadcastHandler: any;

      mockChannel.on.mockImplementation((type, config, handler) => {
        if (config.event === "video_control") {
          broadcastHandler = handler;
        }
        return mockChannel;
      });

      renderHook(
        () =>
          useVideoControl(
            "room-123",
            "user-1",
            true,
            mockSupabase,
            syncFromRemote,
            onChangeEpisode,
          ),
        { wrapper },
      );

      await waitFor(() => expect(broadcastHandler).toBeDefined());

      broadcastHandler({
        payload: {
          action: "play",
          time: 0,
          episodeSlug: "tap-2",
          senderId: "user-2",
        },
      });

      expect(onChangeEpisode).toHaveBeenCalledWith("tap-2");
      expect(syncFromRemote).toHaveBeenCalledWith("play", 0, "tap-2");
    });
  });

  describe("Cleanup", () => {
    it("should cleanup channel on unmount", async () => {
      const syncFromRemote = vi.fn();
      const { unmount } = renderHook(
        () =>
          useVideoControl(
            "room-123",
            "user-1",
            true,
            mockSupabase,
            syncFromRemote,
          ),
        { wrapper },
      );

      await waitFor(() => expect(mockSupabase.channel).toHaveBeenCalled());

      unmount();

      expect(mockChannel.untrack).toHaveBeenCalled();
      expect(mockSupabase.removeChannel).toHaveBeenCalledWith(mockChannel);
    });
  });
});
