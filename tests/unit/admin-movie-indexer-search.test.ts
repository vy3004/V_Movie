import { describe, expect, it } from "vitest";
import { buildMovieSearchParams } from "@/services/admin-movie-indexer/search";

describe("admin movie indexer search", () => {
  it("normalizes keyword and caps search limit", () => {
    expect(buildMovieSearchParams("Thám tử Conan", 100)).toEqual({
      keyword: "tham tu conan",
      limit: 48,
    });
  });
});
