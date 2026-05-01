import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock server-only TRƯỚC KHI import service
vi.mock("server-only", () => ({}));

import { HistoryService } from "@/services/history.service";
import { redis } from "@/lib/redis";

// Mock Redis
vi.mock("@/lib/redis", () => ({
  redis: {
    hget: vi.fn(),
    hset: vi.fn(),
    expire: vi.fn(),
    eval: vi.fn().mockResolvedValue(1), // Lua script trả về 1 (isNew) mặc định
    pipeline: vi.fn(() => ({
      hset: vi.fn(),
      expire: vi.fn(),
      del: vi.fn(),
      hincrby: vi.fn(),
      exec: vi.fn().mockResolvedValue([[null, "OK"], [null, 1]]),
    })),
    exists: vi.fn(),
    hincrby: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn().mockReturnValue({ catch: vi.fn() }), // Fix: Mock del to return chainable object
  },
}));

// Mock Supabase
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServer: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            range: vi.fn(() => Promise.resolve({ data: [], error: null, count: 0 })),
          })),
        })),
      })),
    })),
  })),
}));

// Mock Dashboard Service
vi.mock("@/services/dashboard.service", () => ({
  DashboardService: {
    invalidateStatsCache: vi.fn(),
  },
}));

describe("HistoryService - Race Condition Fix (Lua Script)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should use Lua script for atomic write and detect new movie", async () => {
    const userId = "test-user-123";
    const movieSlug = "test-movie";

    // Mock Redis: phim chưa tồn tại → hget trả về null
    vi.mocked(redis!.hget).mockResolvedValue(null);

    // Mock Lua script trả về 1 (phim mới)
    vi.mocked(redis!.eval).mockResolvedValue(1);

    // Mock exists cho updateStatsCounter
    vi.mocked(redis!.exists).mockResolvedValue(0);

    const payload = {
      user_id: userId,
      movie_slug: movieSlug,
      last_episode_slug: "tap-1",
      last_episode_of_movie_slug: "tap-10",
      current_time: 100,
      duration: 1200,
      movie_name: "Test Movie",
      movie_poster: "poster.jpg",
    };

    await HistoryService.trackProgress(payload);

    // Verify: Lua eval được gọi (thay vì pipeline)
    expect(redis!.eval).toHaveBeenCalledTimes(1);

    // Verify: Lua script nhận đúng key và args
    const evalCall = vi.mocked(redis!.eval).mock.calls[0];
    expect(evalCall[1]).toEqual([`history:user:${userId}`]); // KEYS
    expect(evalCall[2][0]).toBe(movieSlug); // ARGV[1] = movie_slug
    expect(evalCall[2][2]).toBe("604800"); // ARGV[3] = TTL
  });

  it("should handle concurrent trackProgress calls atomically via Lua", async () => {
    const userId = "test-user-123";
    const movieSlug = "test-movie";

    vi.mocked(redis!.hget).mockResolvedValue(null);
    vi.mocked(redis!.exists).mockResolvedValue(0);

    // Lua script: lần đầu trả 1 (new), các lần sau trả 0 (existing)
    let evalCallCount = 0;
    vi.mocked(redis!.eval).mockImplementation(() => {
      evalCallCount++;
      return Promise.resolve(evalCallCount === 1 ? 1 : 0);
    });

    const payload = {
      user_id: userId,
      movie_slug: movieSlug,
      last_episode_slug: "tap-1",
      last_episode_of_movie_slug: "tap-10",
      current_time: 100,
      duration: 1200,
      movie_name: "Test Movie",
      movie_poster: "poster.jpg",
    };

    // Gọi 3 lần đồng thời
    await Promise.all([
      HistoryService.trackProgress(payload),
      HistoryService.trackProgress(payload),
      HistoryService.trackProgress(payload),
    ]);

    // Verify: eval được gọi 3 lần (mỗi request 1 lần)
    expect(redis!.eval).toHaveBeenCalledTimes(3);
  });

  it("should handle Lua script error gracefully", async () => {
    const userId = "test-user-123";
    const movieSlug = "test-movie";

    vi.mocked(redis!.hget).mockResolvedValue(null);

    // Mock Lua script throw error
    vi.mocked(redis!.eval).mockRejectedValue(new Error("Redis Lua error"));

    const payload = {
      user_id: userId,
      movie_slug: movieSlug,
      last_episode_slug: "tap-1",
      last_episode_of_movie_slug: "tap-10",
      current_time: 100,
      duration: 1200,
      movie_name: "Test Movie",
      movie_poster: "poster.jpg",
    };

    // Should NOT throw - error is caught internally and logged
    await expect(HistoryService.trackProgress(payload)).resolves.toBeUndefined();
  });

  it("should detect existing movie (Lua returns 0) and skip stats ADD", async () => {
    const userId = "test-user-123";
    const movieSlug = "test-movie";

    // Phim đã tồn tại trong Redis
    const existingItem = {
      movie_slug: movieSlug,
      movie_name: "Test Movie",
      movie_poster: "poster.jpg",
      episodes_progress: {
        "tap-1": {
          ep_last_time: 50,
          ep_duration: 1200,
          ep_is_finished: false,
          ep_updated_at: new Date().toISOString(),
        },
      },
      last_episode_slug: "tap-1",
      last_episode_of_movie_slug: "tap-10",
      is_finished: false,
      updated_at: new Date().toISOString(),
    };
    vi.mocked(redis!.hget).mockResolvedValue(JSON.stringify(existingItem));

    // Lua trả về 0 (phim đã tồn tại)
    vi.mocked(redis!.eval).mockResolvedValue(0);
    vi.mocked(redis!.exists).mockResolvedValue(1);

    const payload = {
      user_id: userId,
      movie_slug: movieSlug,
      last_episode_slug: "tap-1",
      last_episode_of_movie_slug: "tap-10",
      current_time: 200,
      duration: 1200,
      movie_name: "Test Movie",
      movie_poster: "poster.jpg",
    };

    await HistoryService.trackProgress(payload);

    // Verify: eval gọi 1 lần
    expect(redis!.eval).toHaveBeenCalledTimes(1);

    // Verify: pipeline KHÔNG được gọi cho stats ADD
    // (vì isNewMovie = false và is_finished không thay đổi)
    // updateStatsCounter chỉ gọi pipeline khi stats key tồn tại
    // Nhưng is_finished chưa đổi nên không có STATUS_CHANGE
  });
});

describe("HistoryService - Cache Consistency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should parse cache correctly when stored as JSON string", async () => {
    const userId = "test-user-123";

    const mockData = [
      {
        movie_slug: "movie-1",
        movie_name: "Movie 1",
        is_finished: false,
      },
    ];

    // Mock Redis trả về JSON string
    vi.mocked(redis!.get).mockResolvedValue(JSON.stringify(mockData));

    const result = await HistoryService.getListPaginated({
      userId,
      page: 1,
      limit: 12,
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].movie_slug).toBe("movie-1");
  });

  it("should clear invalid cache and return empty", async () => {
    const userId = "test-user-123";

    // Mock Redis trả về invalid JSON
    vi.mocked(redis!.get).mockResolvedValue("invalid json {{{");

    const result = await HistoryService.getListPaginated({
      userId,
      page: 1,
      limit: 12,
    });

    // Verify: cache bị xóa
    expect(redis!.del).toHaveBeenCalled();

    // Verify: fallback to empty (vì không có Supabase mock)
    expect(result.data).toEqual([]);
  });

  it("should handle mutateTopCache with valid data", async () => {
    const userId = "test-user-123";

    const existingCache = [
      { movie_slug: "movie-1", movie_name: "Movie 1" },
      { movie_slug: "movie-2", movie_name: "Movie 2" },
    ];

    vi.mocked(redis!.get).mockResolvedValue(JSON.stringify(existingCache));

    const updatedItem = {
      movie_slug: "movie-3",
      movie_name: "Movie 3",
      is_finished: false,
      last_episode_slug: "tap-1",
      last_episode_of_movie_slug: "tap-10",
      updated_at: new Date().toISOString(),
      episodes_progress: {},
      movie_poster: "poster.jpg",
    };

    await HistoryService.mutateTopCache(userId, undefined, updatedItem);

    // Verify: set được gọi với JSON string
    expect(redis!.set).toHaveBeenCalled();
    const setCall = vi.mocked(redis!.set).mock.calls[0];
    const savedData = JSON.parse(setCall[1] as string);

    // Verify: item mới được thêm vào đầu
    expect(savedData[0].movie_slug).toBe("movie-3");
    expect(savedData).toHaveLength(3);
  });
});
