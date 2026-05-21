import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/services/admin-movie-indexer/admin.service";
import { MovieIndexerService } from "@/services/admin-movie-indexer/indexer.service";
import { normalizeMovieSource } from "@/services/movie-aggregator.service";
import type { IndexJobMode } from "@/types";

const MAX_MANUAL_PAGES = 20;
const JOB_PAGE_COUNT = 5;
const ACTIONS = new Set(["pause", "resume", "run", "index_page", "index_range"]);

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    return [record.message, record.details, record.hint, record.code]
      .filter((value): value is string => typeof value === "string" && Boolean(value))
      .join(" | ") || JSON.stringify(record);
  }
  return String(error || "Unknown admin movie indexer error");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toPositiveInt(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeRange(body: Record<string, unknown>, action: string) {
  const rawStart = toPositiveInt(body.pageStart, 1);
  const rawEnd = body.pageEnd === undefined
    ? rawStart + toPositiveInt(body.pageCount, action === "index_range" ? 10 : 1) - 1
    : toPositiveInt(body.pageEnd, rawStart);
  const start = Math.min(rawStart, rawEnd);
  const unclampedEnd = action === "index_page" ? start : Math.max(rawStart, rawEnd);
  const maxPages = action === "run" ? JOB_PAGE_COUNT : MAX_MANUAL_PAGES;
  const pageCount = clamp(unclampedEnd - start + 1, 1, maxPages);

  return {
    pageStart: start,
    pageEnd: start + pageCount - 1,
    pageCount,
  };
}

export async function POST(req: NextRequest) {
  await requireAdminUser();

  try {
    const body = await req.json().catch(() => ({}));
    if (!isObject(body)) {
      return NextResponse.json({ ok: false, error: "Request body must be an object" }, { status: 400 });
    }

    const source = normalizeMovieSource(typeof body.source === "string" ? body.source : null);
    const action = typeof body.action === "string" ? body.action : "run";
    if (!ACTIONS.has(action)) {
      return NextResponse.json({ ok: false, error: "Unsupported action" }, { status: 400 });
    }

    const { pageStart, pageEnd, pageCount } = normalizeRange(body, action);
    const mode = (body.mode === "incremental" ? "incremental" : "backfill") satisfies IndexJobMode;

    if (action === "pause") {
      await MovieIndexerService.setSourcePaused(source, true);
      return NextResponse.json({ ok: true });
    }

    if (action === "resume") {
      await MovieIndexerService.setSourcePaused(source, false);
      return NextResponse.json({ ok: true });
    }

    if (action === "run") {
      await MovieIndexerService.enqueueJob(source, mode, pageStart, "admin");
      return NextResponse.json({ ok: true, pageStart, pageEnd, pageCount });
    }

    const results = [];
    for (let page = pageStart; page <= pageEnd; page += 1) {
      const pageResults = await MovieIndexerService.indexSourcePage(source, page);
      results.push(...pageResults.map((result) => ({ ...result, page })));
    }

    revalidatePath("/");

    return NextResponse.json({ ok: true, count: results.length, pageStart, pageEnd, pageCount, results });
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error), count: 0, results: [] }, { status: 500 });
  }
}
