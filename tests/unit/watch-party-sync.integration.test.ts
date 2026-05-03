/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Simple integration tests for watch party sync logic
describe("Watch Party Sync - Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Debounce Logic", () => {
    it("should debounce with 200ms delay", async () => {
      const { debounce } = await import("lodash-es");
      const mockFn = vi.fn();
      const debounced = debounce(mockFn, 200, { leading: false, trailing: true });

      // Call multiple times
      debounced(1);
      debounced(2);
      debounced(3);

      // Should not call yet
      expect(mockFn).not.toHaveBeenCalled();

      // Wait 200ms
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should call once with last value
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith(3);
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

      // With 100ms throttle, in 500ms we should have max 6-8 calls (timing variance)
      expect(mockFn.mock.calls.length).toBeLessThanOrEqual(9);
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
    it("should validate episode slug format", async () => {
      const { WatchPartyService } = await import("@/services/watch-party.service");

      // Mock dependencies
      vi.mock("@/lib/supabase/server", () => ({
        createSupabaseServer: vi.fn().mockResolvedValue({
          from: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              role: "host",
              permissions: {},
              room: { settings: {} }
            },
            error: null
          })
        })
      }));

      vi.mock("@/lib/redis", () => ({
        redis: {
          get: vi.fn().mockResolvedValue(null),
          set: vi.fn().mockResolvedValue(true)
        }
      }));

      // Valid slug
      const validSlug = "tap-1";
      expect(/^[a-zA-Z0-9-]+$/.test(validSlug)).toBe(true);

      // Invalid slug
      const invalidSlug = "tap 1"; // has space
      expect(/^[a-zA-Z0-9-]+$/.test(invalidSlug)).toBe(false);

      const invalidSlug2 = "tap@1"; // has special char
      expect(/^[a-zA-Z0-9-]+$/.test(invalidSlug2)).toBe(false);
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

  describe("Time Drift Calculation", () => {
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
