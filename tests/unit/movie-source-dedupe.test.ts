import { describe, expect, it } from "vitest";
import { dedupeMovies, getMovieDedupeKey } from "@/services/movie-sources/dedupe";
import { Movie } from "@/types";

function movie(overrides: Partial<Movie>): Movie {
  return {
    tmdb: { type: "", id: "", season: null, vote_average: 0, vote_count: 0 },
    imdb: { id: "" },
    created: { time: "" },
    modified: { time: "" },
    _id: overrides._id || overrides.slug || "id",
    name: overrides.name || "",
    slug: overrides.slug || "",
    origin_name: overrides.origin_name || "",
    content: "",
    type: overrides.type || "series",
    status: "ongoing",
    thumb_url: "",
    poster_url: "",
    trailer_url: "",
    is_copyright: false,
    sub_docquyen: false,
    chieurap: false,
    time: "",
    episode_current: "",
    episode_total: "",
    quality: "HD",
    lang: "Vietsub",
    year: overrides.year || 2026,
    view: 0,
    actor: [],
    director: [],
    category: [],
    country: [],
    episodes: [],
    source: overrides.source,
    sources: overrides.sources,
  };
}

describe("movie search dedupe", () => {
  it("builds stable dedupe keys from origin title, name, year, and type", () => {
    expect(
    getMovieDedupeKey(movie({ name: "V? L?m Linh", origin_name: "Zhan Zhao Adventures", year: 2026 })),
    ).toBe("zhan zhao adventures|vu lam linh|2026|series");
  });

  it("merges same movie from multiple sources and prefers OPhim as canonical", () => {
    const result = dedupeMovies([
    movie({ _id: "pa", slug: "vu-lam-linh", name: "V? L?m Linh", origin_name: "Zhan Zhao Adventures", source: "phimapi" }),
    movie({ _id: "op", slug: "vu-lam-linh", name: "V? L?m Linh", origin_name: "Zhan Zhao Adventures", source: "ophim" }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe("op");
    expect(result[0].sources).toEqual(["ophim", "phimapi"]);
  });

  it("keeps same title with different year separate", () => {
    const result = dedupeMovies([
    movie({ slug: "tai-sinh-2024", name: "T?i Sinh", origin_name: "Regeneration", year: 2024, source: "phimapi" }),
    movie({ slug: "tai-sinh-2010", name: "T?i Sinh", origin_name: "Regeneration", year: 2010, source: "ophim" }),
    ]);

    expect(result).toHaveLength(2);
  });
});

