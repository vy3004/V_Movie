import { describe, expect, it } from "vitest";
import { buildAdminMovieQueryParams } from "@/services/admin-movies/query";

describe("admin movie query params", () => {
  it("normalizes pagination and filters", () => {
    expect(
      buildAdminMovieQueryParams({
        keyword: "  Conan  ",
        page: "2",
        limit: "200",
        source: "ophim",
        mergeStatus: "review",
        blocked: "active",
        category: "phim-18",
        type: "series",
        year: "1996",
        duplicateOnly: "true",
      }),
    ).toEqual({
      keyword: "Conan",
      page: 2,
      limit: 100,
      offset: 100,
      source: "ophim",
      mergeStatus: "review",
      blocked: "active",
      category: "phim-18",
      type: "series",
      year: 1996,
      duplicateOnly: true,
    });
  });

  it("uses safe defaults", () => {
    expect(buildAdminMovieQueryParams({})).toEqual({
      keyword: "",
      page: 1,
      limit: 24,
      offset: 0,
      source: "all",
      mergeStatus: "all",
      blocked: "active",
      category: "",
      type: "",
      year: null,
      duplicateOnly: false,
    });
  });
});
