import { describe, expect, it } from "vitest";
import { buildIndexedSourceSnapshot } from "@/services/admin-movie-indexer/normalize";
import { classifyCandidate, mergeSourceIntoMovie, pickPrimarySource } from "@/services/admin-movie-indexer/merge";

const base = buildIndexedSourceSnapshot({
  source: "ophim",
  slug: "conan",
  name: "Thám Tử Lừng Danh Conan",
  origin_name: "Detective Conan",
  year: 1996,
  type: "phim-bo",
  episode_current: "Tập 1200",
  poster_url: "op.jpg",
});

const same = buildIndexedSourceSnapshot({
  source: "phimapi",
  slug: "detective-conan",
  name: "Detective Conan",
  origin_name: "Detective Conan",
  year: 1996,
  type: "phim-bo",
  episode_current: "Tập 1205",
  poster_url: "nc.jpg",
});

describe("admin movie indexer merge", () => {
  it("auto-merges exact origin year type matches", () => {
    expect(classifyCandidate(base, same).decision).toBe("auto_merge");
  });

  it("sends missing year matches to review", () => {
    const missingYear = { ...same, year: null, dedupe_key: "detective conan||phim-bo" };

    expect(classifyCandidate(base, missingYear).decision).toBe("needs_review");
  });

  it("picks source with better episode and poster score", () => {
    expect(pickPrimarySource([base, same])?.source).toBe("phimapi");
  });

  it("merges source and keeps max episode number", () => {
    const movie = mergeSourceIntoMovie(base, same);

    expect(movie.episode_number).toBe(1205);
    expect(movie.sources.map((item) => item.source)).toEqual(["ophim", "phimapi"]);
  });
});

