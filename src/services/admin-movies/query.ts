export type AdminMovieBlockedFilter = "all" | "active" | "blocked";

export type AdminMovieQueryParams = {
  keyword: string;
  page: number;
  limit: number;
  offset: number;
  source: string;
  mergeStatus: string;
  blocked: AdminMovieBlockedFilter;
  category: string;
  type: string;
  year: number | null;
  duplicateOnly: boolean;
};

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function intInRange(value: string, fallback: number, min: number, max: number): number {
  if (!value.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function blockedFilter(value: string): AdminMovieBlockedFilter {
  if (value === "all" || value === "blocked" || value === "active") return value;
  return "active";
}

export function buildAdminMovieQueryParams(raw: RawParams): AdminMovieQueryParams {
  const page = intInRange(first(raw.page), 1, 1, 100000);
  const limit = intInRange(first(raw.limit), 24, 1, 100);
  const yearValue = first(raw.year);
  const year = /^\d{4}$/.test(yearValue) ? Number(yearValue) : null;

  return {
    keyword: first(raw.keyword).trim(),
    page,
    limit,
    offset: (page - 1) * limit,
    source: first(raw.source) || "all",
    mergeStatus: first(raw.mergeStatus) || "all",
    blocked: blockedFilter(first(raw.blocked)),
    category: first(raw.category),
    type: first(raw.type),
    year,
    duplicateOnly: first(raw.duplicateOnly) === "true",
  };
}
