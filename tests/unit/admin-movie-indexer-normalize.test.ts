import { describe, expect, it } from "vitest";
import {
  buildIndexedSourceSnapshot,
  buildSearchText,
  buildSourceRef,
  parseEpisodeNumber,
  parseEpisodeState,
} from "@/services/admin-movie-indexer/normalize";

const card = {
  source: "ophim" as const,
  slug: "tham-tu-lung-danh-conan",
  name: "Thám Tử Lừng Danh Conan",
  origin_name: "Detective Conan",
  episode_current: "Tập 1205",
  year: 1996,
  type: "phim-bo",
  thumb_url: "thumb.jpg",
  poster_url: "poster.jpg",
};

describe("admin movie indexer normalization", () => {
  it("builds source snapshot with normalized search fields", () => {
    const snapshot = buildIndexedSourceSnapshot(card);

    expect(snapshot.source).toBe("ophim");
    expect(snapshot.slug).toBe("tham-tu-lung-danh-conan");
    expect(snapshot.normalized_name).toBe("tham tu lung danh conan");
    expect(snapshot.normalized_origin_name).toBe("detective conan");
    expect(snapshot.episode_number).toBe(1205);
  });

  it("parses episode numbers from common labels", () => {
    expect(parseEpisodeNumber("Tập 1205")).toBe(1205);
    expect(parseEpisodeNumber("Hoàn tất (24/24)")).toBe(24);
    expect(parseEpisodeNumber("Full")).toBe(0);
  });

  it("parses episode states from common labels", () => {
    expect(parseEpisodeState("Trailer")).toBe("trailer");
    expect(parseEpisodeState("Full")).toBe("full");
    expect(parseEpisodeState("Hoàn tất (24/24)")).toBe("completed");
    expect(parseEpisodeState("Tập 12")).toBe("ongoing");
    expect(parseEpisodeState(null)).toBe("unknown");
  });

  it("normalizes season, votes, episode state, and slim source refs", () => {
    const snapshot = buildIndexedSourceSnapshot({
      ...card,
      episode_current: "Hoàn tất (24/24)",
      season: "2",
      vote_average: "7.8",
      vote_count: "1200",
    });

    expect(snapshot.episode_state).toBe("completed");
    expect(snapshot.season).toBe(2);
    expect(snapshot.source_vote_average).toBe(7.8);
    expect(snapshot.source_vote_count).toBe(1200);
    expect(snapshot.vote_average).toBe(7.8);
    expect(snapshot.vote_count).toBe(1200);
    expect(buildSourceRef(snapshot)).toEqual({
      source: "ophim",
      slug: "tham-tu-lung-danh-conan",
      content_hash: snapshot.content_hash,
    });
  });

  it("builds search text from local and original names", () => {
    expect(buildSearchText(["Thám Tử Lừng Danh Conan", "Detective Conan"])).toContain("tham tu lung danh conan");
    expect(buildSearchText(["Thám Tử Lừng Danh Conan", "Detective Conan"])).toContain("detective conan");
  });
});
