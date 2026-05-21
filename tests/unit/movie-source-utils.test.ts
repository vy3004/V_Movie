import { describe, expect, it } from "vitest";
import {
  getAvailableServersForEpisode,
  getEpisodeList,
  getEpisodeProgressKey,
  getMovieHref,
  getSourceBadge,
  prefixServerName,
  normalizeSearchText,
} from "@/services/movie-sources/utils";

describe("movie source utils", () => {
  it("prefixes server names with source badges", () => {
    expect(prefixServerName("ophim", "Vietsub #1")).toBe("OP - Vietsub #1");
    expect(prefixServerName("phimapi", "#Hà Nội (Vietsub)")).toBe(
      "PA - #Hà Nội (Vietsub)",
    );
  });

  it("does not double-prefix server names", () => {
    expect(prefixServerName("ophim", "OP - Vietsub #1")).toBe(
      "OP - Vietsub #1",
    );
  });

  it("normalizes Vietnamese text for search matching", () => {
    expect(normalizeSearchText("Tái Sinh (phần 1)")).toBe("tai sinh phan 1");
  });

  it("builds detail hrefs with source query for non-OPhim movies", () => {
    expect(getMovieHref({ slug: "vu-lam-linh", source: "ophim" })).toBe(
      "/phim/vu-lam-linh",
    );
    expect(getMovieHref({ slug: "vu-lam-linh", source: "phimapi" })).toBe(
      "/phim/vu-lam-linh?source=phimapi",
    );
  });

  it("returns badge labels", () => {
    expect(getSourceBadge("ophim")).toBe("OP");
    expect(getSourceBadge("phimapi")).toBe("PA");
  });

  it("normalizes episode progress keys from names and ranges", () => {
    expect(getEpisodeProgressKey({ name: "Tập 03", slug: "tap-03" })).toBe("3");
    expect(getEpisodeProgressKey({ name: "3", slug: "3" })).toBe("3");
    expect(
      getEpisodeProgressKey({ name: "Tập 78-80", slug: "tap-78-80" }),
    ).toBe("78-80");
    expect(getEpisodeProgressKey({ name: "OVA", slug: "ova" })).toBe("ova");
  });

  it("builds an episode-primary list and available servers by episode key", () => {
    const servers = [
      {
        source: "ophim" as const,
        server_name: "OP - Vietsub",
        server_data: [
          {
            name: "1",
            slug: "1",
            filename: "",
            link_embed: "",
            link_m3u8: "",
            source: "ophim" as const,
          },
          {
            name: "91",
            slug: "91",
            filename: "",
            link_embed: "",
            link_m3u8: "",
            source: "ophim" as const,
          },
        ],
      },
      {
        source: "phimapi" as const,
        server_name: "PA - Vietsub",
        server_data: [
          {
            name: "Tập 01",
            slug: "tap-01",
            filename: "",
            link_embed: "",
            link_m3u8: "",
            source: "phimapi" as const,
          },
        ],
      },
    ];

    expect(
      getEpisodeList(servers).map((episode) => getEpisodeProgressKey(episode)),
    ).toEqual(["1", "91"]);
    expect(
      getAvailableServersForEpisode(servers, "1").map(({ idx }) => idx),
    ).toEqual([0, 1]);
    expect(
      getAvailableServersForEpisode(servers, "91").map(({ idx }) => idx),
    ).toEqual([0]);
  });
});
