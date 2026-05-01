import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock server-only TRƯỚC KHI import bất kỳ module nào
vi.mock("server-only", () => ({}));

// Mock Redis
vi.mock("@/lib/redis", () => ({
  redis: {
    hget: vi.fn(),
    hset: vi.fn(),
    expire: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    pipeline: vi.fn(() => ({
      del: vi.fn(),
      hset: vi.fn(),
      expire: vi.fn(),
      exec: vi.fn().mockResolvedValue([]),
    })),
  },
}));

// Mock Supabase
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServer: vi.fn(),
}));

// Mock Dashboard Service
vi.mock("@/services/dashboard.service", () => ({
  DashboardService: {
    invalidateStatsCache: vi.fn(),
  },
}));

// Import sau khi mock
import { HistoryService } from "@/services/history.service";
import { redis } from "@/lib/redis";
import { createSupabaseServer } from "@/lib/supabase/server";
import { DashboardService } from "@/services/dashboard.service";

describe("HistoryService - Fix #3: Cache Invalidation Strategy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should NOT invalidate cache when syncItemToDB, only mutate", async () => {
    const userId = "test-user-123";
    const movieSlug = "test-movie";

    // Mock Supabase: phim đã tồn tại
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() =>
                Promise.resolve({
                  data: {
                    id: "existing-id",
                    episodes_progress: {},
                    last_episode_of_movie_slug: "tap-10",
                    is_finished: false,
                  },
                  error: null,
                }),
              ),
            })),
          })),
        })),
        upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    };

    vi.mocked(createSupabaseServer).mockResolvedValue(mockSupabase as any);

    // Mock Redis get để mutateTopCache có thể đọc cache
    vi.mocked(redis!.get).mockResolvedValue(
      JSON.stringify([
        { movie_slug: "other-movie", movie_name: "Other" },
      ]),
    );

    const historyItem = {
      movie_slug: movieSlug,
      movie_name: "Test Movie",
      movie_poster: "poster.jpg",
      last_episode_slug: "tap-1",
      last_episode_of_movie_slug: "tap-10",
      episodes_progress: {
        "tap-1": {
          ep_last_time: 100,
          ep_duration: 1200,
          ep_is_finished: false,
          ep_updated_at: new Date().toISOString(),
        },
      },
      is_finished: false,
      updated_at: new Date().toISOString(),
    };

    await HistoryService.syncItemToDB(userId, historyItem);

    // Verify: mutateTopCache được gọi (update cache tại chỗ)
    expect(redis!.set).toHaveBeenCalled();

    // Verify: invalidateHistoryCache KHÔNG được gọi (không xóa cache)
    // Check pipeline.del không được gọi với key history:user:*:top:*
    const pipelineCalls = vi.mocked(redis!.pipeline).mock.results;
    expect(pipelineCalls.length).toBe(0); // Không có pipeline nào được tạo

    // Verify: DashboardService.invalidateStatsCache VẪN được gọi
    expect(DashboardService.invalidateStatsCache).toHaveBeenCalledWith(userId);
  });

  it("should keep cache hit rate high by not invalidating on sync", async () => {
    const userId = "test-user-123";

    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() =>
                Promise.resolve({
                  data: {
                    id: "existing-id",
                    episodes_progress: {},
                    last_episode_of_movie_slug: "tap-10",
                    is_finished: false,
                  },
                  error: null,
                }),
              ),
            })),
          })),
        })),
        upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    };

    vi.mocked(createSupabaseServer).mockResolvedValue(mockSupabase as any);

    // Mock cache tồn tại
    const existingCache = [
      { movie_slug: "movie-1", movie_name: "Movie 1" },
      { movie_slug: "movie-2", movie_name: "Movie 2" },
    ];
    vi.mocked(redis!.get).mockResolvedValue(JSON.stringify(existingCache));

    const historyItem = {
      movie_slug: "movie-1",
      movie_name: "Movie 1 Updated",
      movie_poster: "poster.jpg",
      last_episode_slug: "tap-2",
      last_episode_of_movie_slug: "tap-10",
      episodes_progress: {},
      is_finished: false,
      updated_at: new Date().toISOString(),
    };

    // Sync 1 lần
    await HistoryService.syncItemToDB(userId, historyItem);

    // Verify: cache được update (set được gọi)
    expect(redis!.set).toHaveBeenCalled();

    // Giả lập user quay lại trang chủ ngay sau đó
    vi.clearAllMocks();
    vi.mocked(redis!.get).mockResolvedValue(JSON.stringify(existingCache));

    const result = await HistoryService.getListPaginated({
      userId,
      page: 1,
      limit: 12,
    });

    // Verify: cache hit (get được gọi, không query DB)
    expect(redis!.get).toHaveBeenCalled();
    expect(result.data).toBeDefined();
  });
});

describe("HistoryService - Fix #6: Episode Progress Merge Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should preserve ep_is_finished=true even if new data says false", async () => {
    const userId = "test-user-123";
    const movieSlug = "test-movie";

    // Tạo spy để capture upsert call
    const upsertSpy = vi.fn((data) => Promise.resolve({ data, error: null }));

    // Mock Supabase: tập 1 đã finished
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() =>
                Promise.resolve({
                  data: {
                    id: "existing-id",
                    episodes_progress: {
                      "tap-1": {
                        ep_last_time: 1200,
                        ep_duration: 1200,
                        ep_is_finished: true, // ĐÃ FINISHED
                        ep_updated_at: "2026-05-01T10:00:00.000Z",
                      },
                    },
                    last_episode_of_movie_slug: "tap-10",
                    is_finished: false,
                  },
                  error: null,
                }),
              ),
            })),
          })),
        })),
        upsert: upsertSpy,
      })),
    };

    vi.mocked(createSupabaseServer).mockResolvedValue(mockSupabase as any);

    // Client gửi data mới với ep_is_finished: false (do bug hoặc user tua lại)
    const incomingItem = {
      movie_slug: movieSlug,
      movie_name: "Test Movie",
      movie_poster: "poster.jpg",
      last_episode_slug: "tap-1",
      last_episode_of_movie_slug: "tap-10",
      episodes_progress: {
        "tap-1": {
          ep_last_time: 500, // Tua lại
          ep_duration: 1200,
          ep_is_finished: false, // Client gửi false
          ep_updated_at: new Date().toISOString(),
        },
      },
      is_finished: false,
      updated_at: new Date().toISOString(),
    };

    await HistoryService.syncItemToDB(userId, incomingItem);

    // Verify: upsert được gọi
    expect(upsertSpy).toHaveBeenCalled();

    // Verify: ep_is_finished vẫn là true (không bị ghi đè)
    const upsertedData = upsertSpy.mock.calls[0][0];
    expect(upsertedData.episodes_progress["tap-1"].ep_is_finished).toBe(true);
  });

  it("should allow ep_is_finished to change from false to true", async () => {
    const userId = "test-user-123";
    const movieSlug = "test-movie";

    // Tạo spy để capture upsert call
    const upsertSpy = vi.fn((data) => Promise.resolve({ data, error: null }));

    // Mock Supabase: tập 1 chưa finished
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() =>
                Promise.resolve({
                  data: {
                    id: "existing-id",
                    episodes_progress: {
                      "tap-1": {
                        ep_last_time: 500,
                        ep_duration: 1200,
                        ep_is_finished: false, // CHƯA FINISHED
                        ep_updated_at: "2026-05-01T10:00:00.000Z",
                      },
                    },
                    last_episode_of_movie_slug: "tap-10",
                    is_finished: false,
                  },
                  error: null,
                }),
              ),
            })),
          })),
        })),
        upsert: upsertSpy,
      })),
    };

    vi.mocked(createSupabaseServer).mockResolvedValue(mockSupabase as any);

    // Client gửi data mới với ep_is_finished: true (xem xong)
    const incomingItem = {
      movie_slug: movieSlug,
      movie_name: "Test Movie",
      movie_poster: "poster.jpg",
      last_episode_slug: "tap-1",
      last_episode_of_movie_slug: "tap-10",
      episodes_progress: {
        "tap-1": {
          ep_last_time: 1150,
          ep_duration: 1200,
          ep_is_finished: true, // Xem xong
          ep_updated_at: new Date().toISOString(),
        },
      },
      is_finished: false,
      updated_at: new Date().toISOString(),
    };

    await HistoryService.syncItemToDB(userId, incomingItem);

    // Verify: upsert được gọi
    expect(upsertSpy).toHaveBeenCalled();

    // Verify: ep_is_finished được cập nhật thành true
    const upsertedData = upsertSpy.mock.calls[0][0];
    expect(upsertedData.episodes_progress["tap-1"].ep_is_finished).toBe(true);
  });

  it("should apply same logic in bulkSyncToDB", async () => {
    const userId = "test-user-123";

    // Tạo spy để capture upsert call
    const upsertSpy = vi.fn((data) => Promise.resolve({ data, error: null }));

    // Mock Supabase: có 1 phim với tập 1 đã finished
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn(() =>
              Promise.resolve({
                data: [
                  {
                    id: "existing-id",
                    movie_slug: "movie-1",
                    episodes_progress: {
                      "tap-1": {
                        ep_last_time: 1200,
                        ep_duration: 1200,
                        ep_is_finished: true, // ĐÃ FINISHED
                        ep_updated_at: "2026-05-01T10:00:00.000Z",
                      },
                    },
                    last_episode_of_movie_slug: "tap-10",
                    is_finished: false,
                  },
                ],
                error: null,
              }),
            ),
          })),
        })),
        insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
        upsert: upsertSpy,
      })),
    };

    vi.mocked(createSupabaseServer).mockResolvedValue(mockSupabase as any);

    // Client gửi bulk data với ep_is_finished: false
    const localItems = [
      {
        movie_slug: "movie-1",
        movie_name: "Movie 1",
        movie_poster: "poster.jpg",
        last_episode_slug: "tap-1",
        last_episode_of_movie_slug: "tap-10",
        episodes_progress: {
          "tap-1": {
            ep_last_time: 600,
            ep_duration: 1200,
            ep_is_finished: false, // Client gửi false
            ep_updated_at: new Date().toISOString(),
          },
        },
        is_finished: false,
        updated_at: new Date().toISOString(),
      },
    ];

    await HistoryService.bulkSyncToDB(userId, localItems);

    // Verify: upsert được gọi
    expect(upsertSpy).toHaveBeenCalled();

    // Verify: ep_is_finished vẫn là true
    const upsertedData = upsertSpy.mock.calls[0][0][0];
    expect(upsertedData.episodes_progress["tap-1"].ep_is_finished).toBe(true);
  });
});
