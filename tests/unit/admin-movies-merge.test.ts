import { describe, expect, it } from "vitest";
import { buildMergedMoviePatch, mergeSourceRefs } from "@/services/admin-movies/merge";

describe("admin movie merge helpers", () => {
  it("dedupes sources by source and slug", () => {
    expect(
      mergeSourceRefs([
        [{ source: "ophim", slug: "conan", content_hash: "a" }],
        [{ source: "ophim", slug: "conan", content_hash: "b" }],
        [{ source: "phimapi", slug: "detective-conan", content_hash: "c" }],
      ]),
    ).toEqual([
      { source: "ophim", slug: "conan", content_hash: "b" },
      { source: "phimapi", slug: "detective-conan", content_hash: "c" },
    ]);
  });

  it("builds canonical patch from selected field values and merged sources", () => {
    const patch = buildMergedMoviePatch({
      fieldValues: {
        name: "Detective Conan",
        origin_name: "Detective Conan",
        episode_number: 1205,
      },
      sourceGroups: [
        [{ source: "ophim", slug: "conan" }],
        [{ source: "phimapi", slug: "detective-conan" }],
      ],
    });

    expect(patch).toEqual({
      name: "Detective Conan",
      origin_name: "Detective Conan",
      episode_number: 1205,
      sources: [
        { source: "ophim", slug: "conan" },
        { source: "phimapi", slug: "detective-conan" },
      ],
      merge_status: "merged",
      is_blocked: false,
      last_synced_at: expect.any(String),
    });
  });
});
