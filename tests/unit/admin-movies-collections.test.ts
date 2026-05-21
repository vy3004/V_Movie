import { describe, expect, it } from "vitest";
import { normalizeCollectionItems } from "@/services/admin-movies/collections";

describe("admin movie collections", () => {
  it("normalizes item order and cached slug", () => {
    expect(
      normalizeCollectionItems([
        { movie_id: "m2", slug: "movie-02", label: "Movie 02", item_type: "movie", sort_order: 20 },
        { movie_id: "m1", slug: "tv", label: "TV Series", item_type: "tv_series", sort_order: 10 },
      ]),
    ).toEqual([
      { movie_id: "m1", slug: "tv", label: "TV Series", item_type: "tv_series", sort_order: 10 },
      { movie_id: "m2", slug: "movie-02", label: "Movie 02", item_type: "movie", sort_order: 20 },
    ]);
  });
});
