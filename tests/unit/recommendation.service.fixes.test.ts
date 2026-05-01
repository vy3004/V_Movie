import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock server-only
vi.mock("server-only", () => ({}));

import { RecommendationService } from "@/services/recommendation.service";
import { redis } from "@/lib/redis";

// Mock Redis
vi.mock("@/lib/redis", () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

// Mock Supabase Admin
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

// Mock AI SDK
vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

// Mock Google AI
vi.mock("@ai-sdk/google", () => ({
  google: vi.fn(),
}));

// Mock MovieService
vi.mock("@/services/movie.service", () => ({
  MovieService: {
    search: vi.fn(),
    getByGenre: vi.fn(),
  },
}));

describe("RecommendationService - Fix #8: Rate Limiting Fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should use Redis rate limiting when Redis is available", async () => {
    const userId = "test-user-123";

    // Mock Redis available và chưa có cooldown
    vi.mocked(redis!.get).mockResolvedValue(null);
    vi.mocked(redis!.set).mockResolvedValue("OK");

    // Mock supabaseAdmin.rpc để trả về context
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: [
        {
          user_id: userId,
          total_watch_hours: 50,
          top_genres: ["Hành Động", "Hài Hước"],
          recently_finished: ["movie-1", "movie-2"],
          currently_watching: ["movie-3"],
        },
      ],
      error: null,
    } as any);

    // Mock generateObject
    const { generateObject } = await import("ai");
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        recommendations: Array(12).fill({
          keyword: "Test Movie",
          reason: "Great movie",
        }),
      },
    } as any);

    // Mock MovieService.search để validateWithOphim pass
    const { MovieService } = await import("@/services/movie.service");
    vi.mocked(MovieService.search).mockResolvedValue({
      items: [],
      pagination: { totalItems: 0 },
    } as any);

    await RecommendationService.generateForUser(userId);

    // Verify: Redis get được gọi để check cooldown
    expect(redis!.get).toHaveBeenCalledWith(`recommendation:cooldown:${userId}`);

    // Verify: Redis set được gọi để lưu timestamp
    expect(redis!.set).toHaveBeenCalledWith(
      `recommendation:cooldown:${userId}`,
      expect.any(Number),
      { ex: 3600 },
    );
  });

  it("should enforce cooldown when Redis has timestamp", async () => {
    const userId = "test-user-123";

    // Mock Redis có timestamp (vừa generate 30 phút trước)
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
    vi.mocked(redis!.get).mockResolvedValue(thirtyMinutesAgo);

    await expect(
      RecommendationService.generateForUser(userId),
    ).rejects.toThrow(/Vui lòng đợi \d+ phút/);

    // Verify: không gọi AI API
    const { generateObject } = await import("ai");
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("should use in-memory fallback when Redis is unavailable", async () => {
    const userId = "test-user-456";

    // Mock Redis unavailable (null)
    vi.mocked(redis).mockReturnValue(null as any);

    // Import lại để trigger fallback logic
    const { RecommendationService: FreshService } = await import(
      "@/services/recommendation.service"
    );

    // Mock supabaseAdmin.rpc
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: [
        {
          user_id: userId,
          total_watch_hours: 50,
          top_genres: ["Hành Động"],
          recently_finished: ["movie-1"],
          currently_watching: ["movie-2"],
        },
      ],
      error: null,
    } as any);

    // Mock generateObject
    const { generateObject } = await import("ai");
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        recommendations: Array(12).fill({
          keyword: "Test Movie",
          reason: "Great movie",
        }),
      },
    } as any);

    // Mock MovieService
    const { MovieService } = await import("@/services/movie.service");
    vi.mocked(MovieService.search).mockResolvedValue({
      items: [],
      pagination: { totalItems: 0 },
    } as any);

    // Lần 1: Nên pass (chưa có trong in-memory map)
    await expect(
      FreshService.generateForUser(userId),
    ).resolves.toBeUndefined();

    // Lần 2: Nên bị block (đã có trong in-memory map)
    await expect(FreshService.generateForUser(userId)).rejects.toThrow(
      /Vui lòng đợi \d+ phút/,
    );
  });

  it("should allow request after cooldown expires (Redis)", async () => {
    const userId = "test-user-789";

    // Mock Redis có timestamp (đã qua 61 phút)
    const sixtyOneMinutesAgo = Date.now() - 61 * 60 * 1000;
    vi.mocked(redis!.get).mockResolvedValue(sixtyOneMinutesAgo);
    vi.mocked(redis!.set).mockResolvedValue("OK");

    // Mock supabaseAdmin.rpc
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: [
        {
          user_id: userId,
          total_watch_hours: 50,
          top_genres: ["Hành Động"],
          recently_finished: ["movie-1"],
          currently_watching: ["movie-2"],
        },
      ],
      error: null,
    } as any);

    // Mock generateObject
    const { generateObject } = await import("ai");
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        recommendations: Array(12).fill({
          keyword: "Test Movie",
          reason: "Great movie",
        }),
      },
    } as any);

    // Mock MovieService
    const { MovieService } = await import("@/services/movie.service");
    vi.mocked(MovieService.search).mockResolvedValue({
      items: [],
      pagination: { totalItems: 0 },
    } as any);

    // Nên pass vì đã qua cooldown
    await expect(
      RecommendationService.generateForUser(userId),
    ).resolves.toBeUndefined();

    // Verify: Redis set được gọi để update timestamp mới
    expect(redis!.set).toHaveBeenCalledWith(
      `recommendation:cooldown:${userId}`,
      expect.any(Number),
      { ex: 3600 },
    );
  });

  it("should protect API cost when Redis is down", async () => {
    const userId = "test-user-cost";

    // Mock Redis unavailable
    vi.mocked(redis).mockReturnValue(null as any);

    const { RecommendationService: FreshService } = await import(
      "@/services/recommendation.service"
    );

    // Mock dependencies
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: [
        {
          user_id: userId,
          total_watch_hours: 50,
          top_genres: ["Hành Động"],
          recently_finished: [],
          currently_watching: [],
        },
      ],
      error: null,
    } as any);

    const { generateObject } = await import("ai");
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        recommendations: Array(12).fill({
          keyword: "Test Movie",
          reason: "Great movie",
        }),
      },
    } as any);

    const { MovieService } = await import("@/services/movie.service");
    vi.mocked(MovieService.search).mockResolvedValue({
      items: [],
      pagination: { totalItems: 0 },
    } as any);

    // Gọi 5 lần liên tiếp
    const results = await Promise.allSettled([
      FreshService.generateForUser(userId),
      FreshService.generateForUser(userId),
      FreshService.generateForUser(userId),
      FreshService.generateForUser(userId),
      FreshService.generateForUser(userId),
    ]);

    // Verify: Chỉ lần đầu pass, các lần sau bị reject
    expect(results[0].status).toBe("fulfilled");
    expect(results[1].status).toBe("rejected");
    expect(results[2].status).toBe("rejected");
    expect(results[3].status).toBe("rejected");
    expect(results[4].status).toBe("rejected");

    // Verify: generateObject chỉ được gọi 1 lần (lần đầu)
    expect(generateObject).toHaveBeenCalledTimes(1);
  });
});
