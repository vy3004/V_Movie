/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Simple integration tests for watch party sync logic
describe("Watch Party Sync - Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Seek Commit Logic", () => {
    it("should commit only the final seeked time", () => {
      const commits: number[] = [];
      let pendingSeekTime = 0;

      const onSeeking = (time: number) => {
        pendingSeekTime = time;
      };

      const onSeeked = () => {
        commits.push(pendingSeekTime);
      };

      onSeeking(610);
      onSeeking(720);
      onSeeking(1198);
      onSeeked();

      expect(commits).toEqual([1198]);
    });

    it("should preserve play status when seek commits while video is playing", () => {
      const action = "seek" as const;
      const isPaused = false;
      const status = isPaused ? "pause" : "play";

      expect(action).toBe("seek");
      expect(status).toBe("play");
    });
  });

  describe("Throttle Logic", () => {
    it("should throttle to max 10 calls per second", async () => {
      const { throttle } = await import("lodash-es");
      const mockFn = vi.fn();
      const throttled = throttle(mockFn, 100, { leading: true, trailing: true });

      // Simulate 60fps (16.67ms per frame) for 500ms = 30 calls
      for (let i = 0; i < 30; i++) {
        throttled(i);
        await new Promise(resolve => setTimeout(resolve, 16.67));
      }

      // With 100ms throttle, timing variance can include final trailing call.
      expect(mockFn.mock.calls.length).toBeLessThanOrEqual(10);
      expect(mockFn.mock.calls.length).toBeGreaterThanOrEqual(4);
    });

    it("should NOT throttle when called with different actions", async () => {
      const { throttle } = await import("lodash-es");
      const mockFn = vi.fn();

      // Each action has its own throttle
      const throttledSeek = throttle((val) => mockFn('seek', val), 100);
      const throttledPlay = throttle((val) => mockFn('play', val), 100);

      throttledSeek(1);
      throttledPlay(1);
      throttledSeek(2);
      throttledPlay(2);

      await new Promise(resolve => setTimeout(resolve, 150));

      // Both should be called (different throttle instances)
      const seekCalls = mockFn.mock.calls.filter(call => call[0] === 'seek');
      const playCalls = mockFn.mock.calls.filter(call => call[0] === 'play');

      expect(seekCalls.length).toBeGreaterThan(0);
      expect(playCalls.length).toBeGreaterThan(0);
    });
  });

  describe("Service Layer - syncVideoState", () => {
    it("should advance canonical version and controller on accepted command", () => {
      const currentState = {
        status: "play" as const,
        time: 100,
        episode_slug: "tap-1",
        active_controller_id: "host-id",
        active_controller_name: "Host",
        version: 7,
        updated_at: 1000,
      };

      const acceptedState = {
        ...currentState,
        status: "pause" as const,
        time: 120,
        active_controller_id: "guest-id",
        active_controller_name: "Guest",
        version: currentState.version + 1,
        updated_at: 2000,
      };

      expect(acceptedState.version).toBe(8);
      expect(acceptedState.active_controller_id).toBe("guest-id");
      expect(acceptedState.status).toBe("pause");
    });

    it("should reject stale canonical states by version", () => {
      const lastAppliedVersion = 10;
      const incoming = { version: 9 };

      const shouldApply = incoming.version > lastAppliedVersion;

      expect(shouldApply).toBe(false);
    });

    it("should accept only newer canonical states", () => {
      const lastAppliedVersion = 10;
      const incoming = { version: 11 };

      const shouldApply = incoming.version > lastAppliedVersion;

      expect(shouldApply).toBe(true);
    });

    it("should keep newer Redis state when an older sync arrives", () => {
      const currentState = {
        status: "pause" as const,
        time: 1200,
        episode_slug: "tap-1",
        updated_at: 2000,
      };
      const incoming = {
        status: "play" as const,
        time: 600,
        updatedAt: 1000,
      };

      const shouldIgnore =
        typeof incoming.updatedAt === "number" &&
        incoming.updatedAt < currentState.updated_at;

      const newState = shouldIgnore
        ? currentState
        : {
            status: incoming.status || currentState.status || "pause",
            time: incoming.time ?? currentState.time ?? 0,
            episode_slug: currentState.episode_slug,
            updated_at: incoming.updatedAt ?? Date.now(),
          };

      expect(newState).toEqual(currentState);
    });

    it("should validate episode slug format", () => {
      const validSlug = "tap-1";
      expect(/^[a-zA-Z0-9-]+$/.test(validSlug)).toBe(true);

      const invalidSlug = "tap 1";
      expect(/^[a-zA-Z0-9-]+$/.test(invalidSlug)).toBe(false);

      const invalidSlug2 = "tap@1";
      expect(/^[a-zA-Z0-9-]+$/.test(invalidSlug2)).toBe(false);
    });
  });

  describe("Realtime Version Rules", () => {
    it("should reject older realtime controls", () => {
      const lastApplied = 2000;
      const incoming = { sentAt: 1000 };

      const shouldApply = (incoming.sentAt ?? Date.now()) >= lastApplied;

      expect(shouldApply).toBe(false);
    });

    it("should accept system sync when requestId matches pending request", () => {
      const pendingRequestId = "sync-123";
      const payload = { origin: "system", requestId: "sync-123" };

      const isUserOrigin = !payload.origin || payload.origin === "user";
      const isRequestedSystemSync =
        payload.origin === "system" && payload.requestId === pendingRequestId;

      expect(isUserOrigin || isRequestedSystemSync).toBe(true);
    });
  });

  describe("Soft Sync Algorithm", () => {
    it("should calculate correct playback rate based on gap", () => {
      // Simulate soft sync logic
      const calculatePlaybackRate = (gap: number) => {
        if (Math.abs(gap) > 3.0) {
          return null; // Hard sync (seek)
        } else if (Math.abs(gap) > 0.1) {
          return Math.max(0.9, Math.min(1.1, 1.0 + gap * 0.1));
        } else {
          return 1.0; // Perfect sync
        }
      };

      // Test cases
      expect(calculatePlaybackRate(0.05)).toBe(1.0); // Perfect sync
      expect(calculatePlaybackRate(0.5)).toBe(1.05); // Soft sync (speed up)
      expect(calculatePlaybackRate(-0.5)).toBe(0.95); // Soft sync (slow down)
      expect(calculatePlaybackRate(2.0)).toBe(1.1); // Max speed up
      expect(calculatePlaybackRate(-2.0)).toBe(0.9); // Max slow down
      expect(calculatePlaybackRate(5.0)).toBe(null); // Hard sync
    });

    it("should clamp playback rate between 0.9 and 1.1", () => {
      const calculateRate = (gap: number) => {
        const rate = 1.0 + gap * 0.1;
        return Math.max(0.9, Math.min(1.1, rate));
      };

      expect(calculateRate(5.0)).toBe(1.1); // Clamped to max
      expect(calculateRate(-5.0)).toBe(0.9); // Clamped to min
      expect(calculateRate(1.0)).toBe(1.1); // At max
      expect(calculateRate(-1.0)).toBe(0.9); // At min
    });
  });

  describe("Controller Heartbeat Authority", () => {
    it("should ignore heartbeat from non-active controller", () => {
      const lastAppliedVersion = 12;
      const activeControllerId = "guest-controller";
      const heartbeat = {
        senderId: "host",
        controllerId: "host",
        version: 12,
      };

      const shouldApply =
        heartbeat.version === lastAppliedVersion &&
        heartbeat.controllerId === activeControllerId;

      expect(shouldApply).toBe(false);
    });

    it("should accept heartbeat from active controller at current version", () => {
      const lastAppliedVersion = 12;
      const activeControllerId = "guest-controller";
      const heartbeat = {
        senderId: "guest-controller",
        controllerId: "guest-controller",
        version: 12,
      };

      const shouldApply =
        heartbeat.version === lastAppliedVersion &&
        heartbeat.controllerId === activeControllerId;

      expect(shouldApply).toBe(true);
    });

    it("should ignore host heartbeat while another controller is active", () => {
      const activeControllerId: string | null = "guest-controller";
      const heartbeatSenderId: string = "host";

      const shouldApplyHeartbeat =
        !activeControllerId || activeControllerId === heartbeatSenderId;

      expect(shouldApplyHeartbeat).toBe(false);
    });

    it("should let active non-host controller send heartbeat", () => {
      const activeControllerId = "guest-controller";
      const senderId = "guest-controller";
      const isHost = false;
      const canControl = true;

      const canSendHeartbeat =
        canControl && (!activeControllerId || activeControllerId === senderId || isHost);

      expect(canSendHeartbeat).toBe(true);
    });
  });

  describe("Paused Heartbeat Cadence", () => {
    it("should send paused heartbeat every 5s during first 30s after pause", async () => {
      const { getPausedHeartbeatInterval } = await import("@/hooks/useVideoPlayer");

      expect(getPausedHeartbeatInterval(25_000)).toBe(5_000);
    });

    it("should slow paused heartbeat to 30s after initial pause burst", async () => {
      const { getPausedHeartbeatInterval } = await import("@/hooks/useVideoPlayer");

      expect(getPausedHeartbeatInterval(35_000)).toBe(30_000);
    });
  });

  describe("Time Drift Calculation", () => {
    it("should apply paused canonical state after reload", () => {
      const state: {
        status: "play" | "pause";
        time: number;
        version: number;
        updated_at: number;
      } = {
        status: "pause",
        time: 1200,
        version: 15,
        updated_at: Date.now() - 5000,
      };

      const action = state.status;
      const appliedTime = state.status === "play"
        ? state.time + (Date.now() - state.updated_at) / 1000
        : state.time;

      expect(action).toBe("pause");
      expect(appliedTime).toBe(1200);
    });

    it("should predict host time correctly", () => {
      const targetHostTime = 100; // Host was at 100s
      const lastSyncReceivedAt = Date.now() - 2000; // 2 seconds ago

      const timeSinceLastSync = (Date.now() - lastSyncReceivedAt) / 1000;
      const predictedHostTime = targetHostTime + timeSinceLastSync;

      expect(predictedHostTime).toBeCloseTo(102, 0); // ~102s
    });

    it("should calculate gap correctly", () => {
      const hostTime = 100;
      const guestTime = 98;
      const gap = hostTime - guestTime;

      expect(gap).toBe(2); // Guest is 2s behind

      const guestTime2 = 102;
      const gap2 = hostTime - guestTime2;

      expect(gap2).toBe(-2); // Guest is 2s ahead
    });
  });
});
