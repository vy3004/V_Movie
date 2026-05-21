import { describe, expect, it } from "vitest";
import { nextBatchPages, summarizePageResults } from "@/services/admin-movie-indexer/local-runner";

describe("admin movie indexer local runner", () => {
  it("builds page batches from page 1", () => {
    expect(nextBatchPages(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("summarizes index page results", () => {
    expect(
      summarizePageResults([
        { action: "insert" },
        { action: "update" },
        { action: "skip" },
        { action: "review" },
        { action: "skip" },
      ]),
    ).toEqual({ insert: 1, update: 1, skip: 2, review: 1 });
  });
});
