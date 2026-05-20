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
    (redis as any).get = vi.fn();
    (redis as any).set = vi.fn().mockResolvedValue("OK");
  });

  it("should use Redis rate limiting when Redis is available", async () => {
    const userId = "test-user-123";

    // Mock Redis available vÃ  chÆ°a cÃ³ cooldown
    vi.mocked(redis!.get).mockResolvedValue(null);
    vi.mocked(redis!.set).mockResolvedValue("OK");

    // Mock supabaseAdmin.rpc Ä‘á»ƒ tráº£ vá» context
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: [
        {
          user_id: userId,
          total_watch_hours: 50,
          top_genres: ["HÃ nh Äá»™ng", "HÃ i HÆ°á»›c"],
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

    // Mock MovieService.search Ä‘á»ƒ validateWithOphim pass
    const { MovieService } = await import("@/services/movie.service");
    vi.mocked(MovieService.search).mockResolvedValue({
      items: [],
      pagination: { totalItems: 0 },
    } as any);

    await RecommendationService.generateForUser(userId);

    // Verify: Redis get Ä‘Æ°á»£c gá»i Ä‘á»ƒ check cooldown
    expect(redis!.get).toHaveBeenCalledWith(`recommendation:cooldown:${userId}`);

    // Verify: Redis set Ä‘Æ°á»£c gá»i Ä‘á»ƒ lÆ°u timestamp
    expect(redis!.set).toHaveBeenCalledWith(
      `recommendation:cooldown:${userId}`,
      expect.any(Number),
      { ex: 3600 },
    );
  });

  it("should enforce cooldown when Redis has timestamp", async () => {
    const userId = "test-user-123";

    // Mock Redis cÃ³ timestamp (vá»«a generate 30 phút trÆ°á»›c)
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
    vi.mocked(redis!.get).mockResolvedValue(thirtyMinutesAgo);

    await expect(
      RecommendationService.generateForUser(userId),
    ).rejects.toThrow(/Vui lòng đợi \d+ phút/);

    // Verify: khÃ´ng gá»i AI API
    const { generateObject } = await import("ai");
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("should use in-memory fallback when Redis is unavailable", async () => {
    const userId = "test-user-456";

    // Mock Redis unavailable (null)
    (redis as any).get = undefined;

    // Import láº¡i Ä‘á»ƒ trigger fallback logic
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
          top_genres: ["HÃ nh Äá»™ng"],
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

    // Láº§n 1: NÃªn pass (chÆ°a cÃ³ trong in-memory map)
    await expect(
      FreshService.generateForUser(userId),
    ).resolves.toBeUndefined();

    // Láº§n 2: NÃªn bá»‹ block (Ä‘Ã£ cÃ³ trong in-memory map)
    await expect(FreshService.generateForUser(userId)).rejects.toThrow(
      /Vui lòng đợi \d+ phút/,
    );
  });

  it("should allow request after cooldown expires (Redis)", async () => {
    const userId = "test-user-789";

    // Mock Redis cÃ³ timestamp (Ä‘Ã£ qua 61 phút)
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
          top_genres: ["HÃ nh Äá»™ng"],
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

    // NÃªn pass vÃ¬ Ä‘Ã£ qua cooldown
    await expect(
      RecommendationService.generateForUser(userId),
    ).resolves.toBeUndefined();

    // Verify: Redis set Ä‘Æ°á»£c gá»i Ä‘á»ƒ update timestamp má»›i
    expect(redis!.set).toHaveBeenCalledWith(
      `recommendation:cooldown:${userId}`,
      expect.any(Number),
      { ex: 3600 },
    );
  });

  it("should protect API cost when Redis is down", async () => {
    const userId = "test-user-cost";

    // Mock Redis unavailable
    (redis as any).get = undefined;

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
          top_genres: ["HÃ nh Äá»™ng"],
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

    // Gá»i 5 láº§n liÃªn tiáº¿p
    const results = await Promise.allSettled([
      FreshService.generateForUser(userId),
      FreshService.generateForUser(userId),
      FreshService.generateForUser(userId),
      FreshService.generateForUser(userId),
      FreshService.generateForUser(userId),
    ]);

    // Verify: Chá»‰ láº§n Ä‘áº§u pass, cÃ¡c láº§n sau bá»‹ reject
    expect(results[0].status).toBe("fulfilled");
    expect(results[1].status).toBe("rejected");
    expect(results[2].status).toBe("rejected");
    expect(results[3].status).toBe("rejected");
    expect(results[4].status).toBe("rejected");

    // Verify: generateObject chá»‰ Ä‘Æ°á»£c gá»i 1 láº§n (láº§n Ä‘áº§u)
    expect(generateObject).toHaveBeenCalledTimes(1);
  });
});

