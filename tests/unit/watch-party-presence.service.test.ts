import { beforeEach, describe, expect, it, vi } from "vitest";

const redis = {
  zrange: vi.fn(),
  get: vi.fn(),
  mget: vi.fn(),
  smembers: vi.fn(),
  pipeline: vi.fn(),
};

vi.mock("server-only", () => ({}));
vi.mock("@/lib/redis", () => ({ redis }));

describe("WatchPartyPresenceService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redis.pipeline.mockReturnValue({
      zrem: vi.fn(),
      srem: vi.fn(),
      exec: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("does not mark user stale when another session still has active lease", async () => {
    const { WatchPartyPresenceService } = await import(
      "@/services/watch-party-presence.service"
    );
    const now = 1_000_000;
    const activeLease = {
      room_id: "room-1",
      user_id: "guest-1",
      session_id: "new-session",
      status: "online",
      source: "data-channel",
      last_seen_at: now,
    };

    redis.zrange
      .mockResolvedValueOnce(["guest-1:old-session"])
      .mockResolvedValueOnce(["old-session", "new-session"]);
    redis.get.mockResolvedValueOnce(null);
    redis.smembers.mockResolvedValueOnce(["old-session", "new-session"]);
    redis.mget.mockResolvedValueOnce([activeLease]);

    const staleUserIds = await WatchPartyPresenceService.getStaleUserIds(
      "room-1",
      now,
    );

    expect(staleUserIds).toEqual([]);
  });
});
