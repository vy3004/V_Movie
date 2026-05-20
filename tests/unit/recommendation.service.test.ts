import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock server-only TRÆ¯á»šC KHI import service
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
    from: vi.fn(() => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })),
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
  },
}));

describe("RecommendationService - Rate Limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redis!.set).mockResolvedValue("OK");
  });

  it("should allow first generation request", async () => {
    const userId = "test-user-123";

    // Mock: ChÆ°a cÃ³ cooldown
    vi.mocked(redis!.get).mockResolvedValue(null);

    // Mock Supabase RPC
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: [
        {
          user_id: userId,
          total_watch_hours: 50,
          top_genres: ["hanh-dong", "kinh-di"],
          recently_finished: ["Movie 1", "Movie 2"],
          currently_watching: ["Movie 3"],
        },
      ],
      error: null,
    } as any);

    // Mock AI generation
    const { generateObject } = await import("ai");
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        recommendations: [
          { keyword: "Inception", reason: "Phim hay" },
          { keyword: "Interstellar", reason: "Phim Ä‘á»‰nh" },
          { keyword: "The Matrix", reason: "Phim kinh Ä‘iá»ƒn" },
          { keyword: "Fight Club", reason: "Phim cult" },
          { keyword: "Pulp Fiction", reason: "Phim Tarantino" },
          { keyword: "The Godfather", reason: "Phim mafia" },
          { keyword: "The Dark Knight", reason: "Phim Batman" },
          { keyword: "Forrest Gump", reason: "Phim cáº£m Ä‘á»™ng" },
          { keyword: "The Shawshank Redemption", reason: "Phim trá»‘n tÃ¹" },
          { keyword: "Schindler's List", reason: "Phim lá»‹ch sá»­" },
          { keyword: "The Lord of the Rings", reason: "Phim fantasy" },
          { keyword: "Star Wars", reason: "Phim sci-fi" },
        ],
      },
    } as any);

    // Mock MovieService.search
    const { MovieService } = await import("@/services/movie.service");
    vi.mocked(MovieService.search).mockResolvedValue({
      items: [
        {
          slug: "inception",
          name: "Inception",
          thumb_url: "thumb.jpg",
          episode_current: "Full",
          category: [{ name: "HÃ nh Äá»™ng", slug: "hanh-dong" }],
        } as any,
      ],
      params: {} as any,
      titlePage: "",
      breadCrumb: [],
      seoOnPage: {} as any,
    });

    await RecommendationService.generateForUser(userId);

    // Verify: Redis set Ä‘Æ°á»£c gá»i Ä‘á»ƒ lÆ°u cooldown
    expect(redis!.set).toHaveBeenCalledWith(
      `recommendation:cooldown:${userId}`,
      expect.any(Number),
      { ex: 3600 }
    );
  });

  it("should throw rate limit error within cooldown period", async () => {
    const userId = "test-user-123";
    const now = Date.now();

    // Mock: CÃ³ cooldown (vá»«a generate 30 phút trÆ°á»›c)
    vi.mocked(redis!.get).mockResolvedValue(now - 30 * 60 * 1000); // 30 minutes ago

    // Service giá» Ä‘Ã£ re-throw rate limit errors
    await expect(
      RecommendationService.generateForUser(userId)
    ).rejects.toThrow("Vui lòng đợi");

    // Verify: KhÃ´ng gá»i AI
    const { generateObject } = await import("ai");
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("should allow request after cooldown expires", async () => {
    const userId = "test-user-123";
    const now = Date.now();

    // Mock: Cooldown Ä‘Ã£ háº¿t (generate 2 giá» trÆ°á»›c)
    vi.mocked(redis!.get).mockResolvedValue(now - 2 * 60 * 60 * 1000); // 2 hours ago

    // Mock Supabase RPC
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: [
        {
          user_id: userId,
          total_watch_hours: 50,
          top_genres: ["hanh-dong"],
          recently_finished: ["Movie 1"],
          currently_watching: ["Movie 2"],
        },
      ],
      error: null,
    } as any);

    // Mock AI generation
    const { generateObject } = await import("ai");
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        recommendations: Array(12).fill({
          keyword: "Test Movie",
          reason: "Test reason",
        }),
      },
    } as any);

    // Mock MovieService.search
    const { MovieService } = await import("@/services/movie.service");
    vi.mocked(MovieService.search).mockResolvedValue({
      items: [
        {
          slug: "test",
          name: "Test",
          thumb_url: "thumb.jpg",
          episode_current: "Full",
          category: [{ name: "HÃ nh Äá»™ng", slug: "hanh-dong" }],
        } as any,
      ],
      params: {} as any,
      titlePage: "",
      breadCrumb: [],
      seoOnPage: {} as any,
    });

    await RecommendationService.generateForUser(userId);

    // Verify: AI Ä‘Æ°á»£c gá»i
    expect(generateObject).toHaveBeenCalled();

    // Verify: Cooldown má»›i Ä‘Æ°á»£c set
    expect(redis!.set).toHaveBeenCalledWith(
      `recommendation:cooldown:${userId}`,
      expect.any(Number),
      { ex: 3600 }
    );
  });

  it("should throw with correct remaining time in error message", async () => {
    const userId = "test-user-123";
    const now = Date.now();

    // Mock: Generate 45 phút trÆ°á»›c (cÃ²n 15 phút cooldown)
    vi.mocked(redis!.get).mockResolvedValue(now - 45 * 60 * 1000);

    // Verify: Error chá»©a thÃ´ng tin thá»i gian chá»
    await expect(
      RecommendationService.generateForUser(userId)
    ).rejects.toThrow(/Vui lòng đợi \d+ phút/);

    // Verify: KhÃ´ng gá»i AI vÃ¬ cÃ²n cooldown
    const { generateObject } = await import("ai");
    expect(generateObject).not.toHaveBeenCalled();
  });
});

