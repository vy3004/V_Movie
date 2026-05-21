import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({ redis: null }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    rpc,
  },
}));

import { IndexedMovieService } from "@/services/indexed-movie.service";

const conanRow = {
  id: "movie-1",
  slug: "tham-tu-lung-danh-conan",
  name: "Thám Tử Lừng Danh",
  origin_name: "Detective Conan",
  year: 2024,
  type: "series",
  thumb_url: "https://img.example/conan-thumb.jpg",
  poster_url: "https://img.example/conan-poster.jpg",
  episode_current: "T?p 1100",
  episode_number: 1100,
  episode_state: "ongoing",
  season: null,
  quality: "HD",
  lang: "Vietsub",
  category_slugs: ["hoat-hinh"],
  country_slugs: ["nhat-ban"],
  vote_average: 8.5,
  vote_count: 1000,
  popularity_score: 950,
  primary_source: "ophim",
  primary_source_slug: "tham-tu-lung-danh-conan",
  last_synced_at: "2026-05-18T00:00:00.000Z",
  rank_score: 120,
  total_count: 1,
};

describe("IndexedMovieService DB search", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("returns empty search page without hitting DB for short keywords", async () => {
    const result = await IndexedMovieService.searchIndexedMovies("c", 1, 24);

    expect(rpc).not.toHaveBeenCalled();
    expect(result.items).toEqual([]);
    expect(result.params.type_slug).toBe("tim-kiem");
    expect(result.params.pagination).toMatchObject({
      totalItems: 0,
      totalItemsPerPage: 24,
      currentPage: 1,
    });
  });

  it("maps DB search rows to PageMoviesData movies and pagination", async () => {
    rpc.mockResolvedValue({ data: [conanRow], error: null });

    const result = await IndexedMovieService.searchIndexedMovies(
      "conan",
      2,
      24,
    );

    expect(rpc).toHaveBeenCalledWith("search_movies", {
      search_keyword: "conan",
      page_number: 2,
      page_size: 24,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      _id: "movie-1",
      name: "Th?m T? L?ng Danh Conan",
      slug: "tham-tu-lung-danh-conan",
      source: "ophim",
      sourceSlug: "tham-tu-lung-danh-conan",
    });
    expect(result.params.pagination).toMatchObject({
      totalItems: 1,
      totalItemsPerPage: 24,
      currentPage: 2,
    });
    expect(result.titlePage).toBe("T?m ki?m: conan");
  });

  it("returns DB cursor when modal DB search has more pages", async () => {
    rpc.mockResolvedValue({
      data: [{ ...conanRow, total_count: 11 }],
      error: null,
    });

    const result = await IndexedMovieService.searchIndexedMoviesModal(
      "conan",
      10,
    );

    expect(rpc).toHaveBeenCalledWith("search_movies", {
      search_keyword: "conan",
      page_number: 1,
      page_size: 10,
    });
    expect(result.items).toHaveLength(1);
    expect(result.searchPhase).toBe("db");
    expect(result.nextCursor).toMatchObject({
      phase: "db",
      dbPage: 2,
      pages: { ophim: 1, phimapi: 1 },
      exhausted: { ophim: false, phimapi: false },
      returned: 1,
    });
  });

  it("returns fallback cursor when first modal DB page has no rows", async () => {
    rpc.mockResolvedValue({ data: [], error: null });

    const result = await IndexedMovieService.searchIndexedMoviesModal(
      "missing",
      10,
    );

    expect(result.items).toEqual([]);
    expect(result.searchPhase).toBe("db");
    expect(result.nextCursor).toMatchObject({
      phase: "fallback",
      pages: { ophim: 1, phimapi: 1 },
      exhausted: { ophim: false, phimapi: false },
      returned: 0,
    });
  });

  it("returns fallback cursor after last modal DB page", async () => {
    rpc.mockResolvedValue({
      data: [{ ...conanRow, total_count: 11 }],
      error: null,
    });

    const result = await IndexedMovieService.searchIndexedMoviesModal(
      "conan",
      10,
      {
        phase: "db",
        dbPage: 2,
        pages: { ophim: 1, phimapi: 1 },
        exhausted: { ophim: false, phimapi: false },
        seenKeys: [],
        returned: 10,
      },
    );

    expect(rpc).toHaveBeenCalledWith("search_movies", {
      search_keyword: "conan",
      page_number: 2,
      page_size: 10,
    });
    expect(result.items).toHaveLength(1);
    expect(result.searchPhase).toBe("db");
    expect(result.nextCursor).toMatchObject({
      phase: "fallback",
      returned: 11,
    });
  });
});
