﻿import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {},
}));

import {
  buildIndexJobInsert,
  buildIndexMovieCardPlan,
} from "@/services/admin-movie-indexer/indexer.service";
import {
  parseOphimListPage,
  parsePhimApiListPage,
} from "@/services/admin-movie-indexer/source-clients";
import { buildIndexedSourceSnapshot } from "@/services/admin-movie-indexer/normalize";
import { IndexedMovie, SourceMovieCardInput } from "@/types";

const conanCard: SourceMovieCardInput = {
  source: "ophim",
  slug: "tham-tu-lung-danh-conan",
  name: "Thám Tử Lừng Danh Conan",
  origin_name: "Detective Conan",
  episode_current: "Tập 1205",
  year: 1996,
  type: "series",
};

function existingMovieFrom(card: SourceMovieCardInput): IndexedMovie {
  const snapshot = buildIndexedSourceSnapshot(card);
  return {
    id: "movie-1",
    slug: snapshot.slug,
    name: snapshot.name,
    origin_name: snapshot.origin_name,
    normalized_name: snapshot.normalized_name,
    normalized_origin_name: snapshot.normalized_origin_name,
    search_text: snapshot.search_text,
    dedupe_key: snapshot.dedupe_key,
    year: snapshot.year,
    type: snapshot.type,
    status: snapshot.status ?? null,
    thumb_url: snapshot.thumb_url ?? null,
    poster_url: snapshot.poster_url ?? null,
    episode_current: snapshot.episode_current,
    episode_number: snapshot.episode_number,
    quality: snapshot.quality ?? null,
    lang: snapshot.lang ?? null,
    category_slugs: snapshot.category_slugs ?? [],
    country_slugs: snapshot.country_slugs ?? [],
    sources: [snapshot],
    primary_source: snapshot.source,
    primary_source_slug: snapshot.slug,
    merge_status: "merged",
    content_hash: snapshot.content_hash,
    last_synced_at: null,
  };
}

describe("admin movie indexer service", () => {
  it("builds small backfill jobs", () => {
    expect(buildIndexJobInsert("ophim", "backfill", 10, "admin")).toEqual({
      source: "ophim",
      mode: "backfill",
      page_start: 10,
      page_end: 14,
      status: "queued",
      created_by: "admin",
    });
  });

  it("parses OPhim list cards", () => {
    expect(
      parseOphimListPage({
        data: { APP_DOMAIN_CDN_IMAGE: "https://img.ophim.live" },
        items: [
          {
            slug: "conan",
            name: "Conan",
            origin_name: "Detective Conan",
            episode_current: "Tập 1205",
            year: "1996",
            thumb_url: "conan-thumb.jpg",
            category: [{ slug: "hoat-hinh" }],
            modified: { time: "2026-05-17" },
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        source: "ophim",
        slug: "conan",
        name: "Conan",
        origin_name: "Detective Conan",
        episode_current: "Tập 1205",
        year: 1996,
        thumb_url: "https://img.ophim.live/uploads/movies/conan-thumb.jpg",
        category_slugs: ["hoat-hinh"],
        updated_at: "2026-05-17",
      }),
    ]);
  });

  it("parses PhimAPI list cards", () => {
    expect(
      parsePhimApiListPage({
        data: {
          items: [
            {
              slug: "one-piece",
              name: "One Piece",
              origin_name: "One Piece",
              current_episode: "Tập 1100",
              thumb_url: "thumb.jpg",
              poster_url: "poster.jpg",
            },
          ],
        },
      })[0],
    ).toEqual(
      expect.objectContaining({
        source: "phimapi",
        slug: "one-piece",
        episode_current: "Tập 1100",
        thumb_url: "https://phimimg.com/poster.jpg",
        poster_url: "https://phimimg.com/thumb.jpg",
      }),
    );
  });

  it("plans insert when no indexed movie exists", () => {
    const plan = buildIndexMovieCardPlan(conanCard, []);

    expect(plan.action).toBe("insert");
    if (plan.action === "insert") {
      expect(plan.movie.sources).toHaveLength(1);
      expect(plan.movie.primary_source).toBe("ophim");
    }
  });

  it("marks new phim-18 movies for review", () => {
    const plan = buildIndexMovieCardPlan(
      { ...conanCard, category_slugs: ["phim-18"] },
      [],
    );

    expect(plan.action).toBe("insert");
    if (plan.action === "insert") {
      expect(plan.movie.merge_status).toBe("review");
    }
  });

  it("plans auto merge for strict origin year type match", () => {
    const existing = existingMovieFrom(conanCard);
    const plan = buildIndexMovieCardPlan(
      {
        ...conanCard,
        source: "phimapi",
        slug: "detective-conan",
        episode_current: "Tập 1300",
      },
      [existing],
    );

    expect(plan.action).toBe("update");
    if (plan.action === "update") {
      expect(plan.movie.sources).toHaveLength(2);
      expect(plan.movie.episode_number).toBe(1300);
    }
  });

  it("plans update when slug already exists", () => {
    const existing = existingMovieFrom(conanCard);
    const plan = buildIndexMovieCardPlan(
      {
        ...conanCard,
        origin_name: "Different Origin",
        type: "single",
        episode_current: "Tập 1301",
      },
      [existing],
    );

    expect(plan.action).toBe("update");
    if (plan.action === "update") {
      expect(plan.movie.episode_number).toBe(1301);
    }
  });

  it("skips unchanged source snapshot", () => {
    const existing = existingMovieFrom(conanCard);
    const plan = buildIndexMovieCardPlan(conanCard, [existing]);

    expect(plan.action).toBe("skip");
    if (plan.action === "skip") {
      expect(plan.reason).toBe("unchanged");
    }
  });

  it("plans review when identity is ambiguous", () => {
    const existing = existingMovieFrom({ ...conanCard, year: null });
    const plan = buildIndexMovieCardPlan(
      { ...conanCard, source: "phimapi", slug: "conan-phimapi" },
      [existing],
    );

    expect(plan.action).toBe("review");
    if (plan.action === "review") {
      expect(plan.review.target_movie_id).toBe("movie-1");
      expect(plan.review.reason).toBe("missing_year");
    }
  });
});
