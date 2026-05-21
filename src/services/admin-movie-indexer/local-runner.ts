import { MovieSource } from "@/types";

export type IndexAction = "insert" | "update" | "skip" | "review";

export interface PageSummary {
  insert: number;
  update: number;
  skip: number;
  review: number;
}

export interface SourceProgress {
  source: MovieSource;
  nextPage: number;
  done: boolean;
}

export function nextBatchPages(pageStart: number, pageCount: number): number[] {
  return Array.from({ length: pageCount }, (_, index) => pageStart + index);
}

export function summarizePageResults(results: Array<{ action: IndexAction }>): PageSummary {
  return results.reduce<PageSummary>(
    (summary, result) => ({
      ...summary,
      [result.action]: summary[result.action] + 1,
    }),
    { insert: 0, update: 0, skip: 0, review: 0 },
  );
}

export function addPageSummary(total: PageSummary, page: PageSummary): PageSummary {
  return {
    insert: total.insert + page.insert,
    update: total.update + page.update,
    skip: total.skip + page.skip,
    review: total.review + page.review,
  };
}
