"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MovieSource } from "@/types";

type IndexPageResult = {
  action?: string;
  reason?: string;
};

function clampPage(value: number) {
  return Math.max(1, Math.floor(Number.isFinite(value) ? value : 1));
}

function summarizeIndexResults(results: unknown): string | null {
  if (!Array.isArray(results)) return null;

  const counts = results.reduce(
    (acc, result) => {
      const item = result as IndexPageResult;
      if (item.action === "insert") acc.insert += 1;
      if (item.action === "update") acc.update += 1;
      if (item.action === "review") acc.review += 1;
      if (item.action === "skip" && item.reason === "unchanged") acc.unchanged += 1;
      if (item.action === "skip" && item.reason !== "unchanged") acc.skipped += 1;
      return acc;
    },
    { insert: 0, update: 0, unchanged: 0, skipped: 0, review: 0 },
  );

  return [
    `insert: ${counts.insert}`,
    `update: ${counts.update}`,
    `skip unchanged: ${counts.unchanged}`,
    `skip other: ${counts.skipped}`,
    `review: ${counts.review}`,
  ].join(" · ");
}

export default function SyncSourceActions({
  source,
  page,
  paused,
}: {
  source: MovieSource;
  page: number;
  paused: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pageStart, setPageStart] = useState(clampPage(page));
  const [pageEnd, setPageEnd] = useState(clampPage(page));
  const normalizedStart = Math.min(clampPage(pageStart), clampPage(pageEnd));
  const normalizedEnd = Math.max(clampPage(pageStart), clampPage(pageEnd));
  const pageCount = normalizedEnd - normalizedStart + 1;
  const pendingDisabled = Boolean(pending);

  function setRange(start: number, end: number) {
    setPageStart(clampPage(start));
    setPageEnd(clampPage(end));
  }

  async function runAction(action: "pause" | "resume" | "run" | "index_page" | "index_range") {
    setPending(action);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/movie-indexer/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          action,
          pageStart: normalizedStart,
          pageEnd: action === "index_page" ? normalizedStart : normalizedEnd,
          mode: "backfill",
        }),
      });

      const body = await res.json().catch(() => null);
      if (!res.ok || body?.ok === false) {
        setMessage(body?.error || "Action failed");
      } else if (action === "index_page" || action === "index_range") {
        const summary = summarizeIndexResults(body?.results);
        const range = body?.pageStart && body?.pageEnd ? `pages ${body.pageStart}-${body.pageEnd}` : "pages";
        setMessage(summary ? `Indexed ${body?.count || 0} cards · ${range} · ${summary}` : `Indexed ${body?.count || 0} cards · ${range}`);
      } else if (action === "run") {
        const range = body?.pageStart && body?.pageEnd ? `pages ${body.pageStart}-${body.pageEnd}` : `from page ${normalizedStart}`;
        setMessage(`Queued job · ${range}`);
      } else {
        setMessage("Updated");
      }

      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mt-5 space-y-3">
      <div className="rounded-3xl border border-zinc-800 bg-black/30 p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-2 rounded-2xl border border-zinc-800 px-3 py-2 text-xs font-bold text-zinc-400">
            From
            <input
              type="number"
              min={1}
              value={pageStart}
              disabled={pendingDisabled}
              onChange={(event) => setPageStart(clampPage(Number(event.target.value || 1)))}
              className="w-20 bg-transparent text-right text-white outline-none"
            />
          </label>
          <label className="flex items-center justify-between gap-2 rounded-2xl border border-zinc-800 px-3 py-2 text-xs font-bold text-zinc-400">
            To
            <input
              type="number"
              min={1}
              value={pageEnd}
              disabled={pendingDisabled}
              onChange={(event) => setPageEnd(clampPage(Number(event.target.value || 1)))}
              className="w-20 bg-transparent text-right text-white outline-none"
            />
          </label>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-wider text-zinc-500">
          <span className="rounded-full bg-zinc-900 px-3 py-1 text-zinc-300">
            Range {normalizedStart}-{normalizedEnd} · {pageCount} page{pageCount > 1 ? "s" : ""}
          </span>
          <button type="button" disabled={pendingDisabled} onClick={() => setRange(page, page)} className="hover:text-white disabled:opacity-50">
            Current
          </button>
          <button type="button" disabled={pendingDisabled} onClick={() => setRange(page, page + 4)} className="hover:text-white disabled:opacity-50">
            Next 5
          </button>
          <button type="button" disabled={pendingDisabled} onClick={() => setRange(page, page + 9)} className="hover:text-white disabled:opacity-50">
            Next 10
          </button>
          <button type="button" disabled={pendingDisabled} onClick={() => setRange(page, page)} className="hover:text-white disabled:opacity-50">
            Reset
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pendingDisabled}
          onClick={() => runAction("index_page")}
          className="rounded-2xl bg-red-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending === "index_page" ? "Indexing..." : "Run start page"}
        </button>
        <button
          type="button"
          disabled={pendingDisabled}
          onClick={() => runAction("index_range")}
          className="rounded-2xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending === "index_range" ? "Indexing..." : "Run selected range"}
        </button>
        <button
          type="button"
          disabled={pendingDisabled}
          onClick={() => runAction("run")}
          className="rounded-2xl border border-zinc-700 px-4 py-2 text-xs font-black uppercase tracking-widest text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Queue from start
        </button>
        <button
          type="button"
          disabled={pendingDisabled}
          onClick={() => runAction(paused ? "resume" : "pause")}
          className="rounded-2xl border border-zinc-700 px-4 py-2 text-xs font-black uppercase tracking-widest text-zinc-400 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {paused ? "Resume" : "Pause"}
        </button>
      </div>
      {message ? <p className="text-xs font-bold text-zinc-400">{message}</p> : null}
    </div>
  );
}
