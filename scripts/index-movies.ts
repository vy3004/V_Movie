import { loadEnvConfig } from "@next/env";
import { addPageSummary, nextBatchPages, summarizePageResults, type PageSummary } from "../src/services/admin-movie-indexer/local-runner";
import { MovieSource } from "../src/types";

loadEnvConfig(process.cwd());

let supabaseAdmin: typeof import("../src/lib/supabase/admin")["supabaseAdmin"];
let MovieIndexerService: typeof import("../src/services/admin-movie-indexer/indexer.service")["MovieIndexerService"];

const PAGE_DELAY_MS = 1500;
const DEFAULT_SOURCES: MovieSource[] = ["ophim", "phimapi"];

interface RunnerOptions {
  sources: MovieSource[];
  from: number;
  pagesPerBatch: number;
  reset: boolean;
}

function parseArgs(): RunnerOptions {
  const args = new Map(
    process.argv.slice(2).map((arg) => {
      const [key, value = "true"] = arg.replace(/^--/, "").split("=");
      return [key, value];
    }),
  );

  const sources = (args.get("sources") || DEFAULT_SOURCES.join(","))
    .split(",")
    .map((source) => source.trim())
    .filter(Boolean) as MovieSource[];

  return {
    sources,
    from: Number(args.get("from") || 1),
    pagesPerBatch: Number(args.get("pages-per-batch") || 5),
    reset: args.get("reset") === "true",
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resetSourceState(source: MovieSource, from: number) {
  const { error } = await supabaseAdmin
    .from("movie_index_state")
    .upsert({
      source,
      mode: "backfill",
      backfill_page: from,
      backfill_done: false,
      paused: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: "source" });

  if (error) throw error;
}

async function updateSourceProgress(source: MovieSource, nextPage: number, done: boolean) {
  const { error } = await supabaseAdmin
    .from("movie_index_state")
    .update({
      backfill_page: nextPage,
      backfill_done: done,
      last_run_at: new Date().toISOString(),
      last_success_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("source", source);

  if (error) throw error;
}

async function markSourceError(source: MovieSource, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  await supabaseAdmin
    .from("movie_index_state")
    .update({ last_error: message, updated_at: new Date().toISOString() })
    .eq("source", source);
}

async function getSourceState(source: MovieSource, from: number) {
  const { data, error } = await supabaseAdmin
    .from("movie_index_state")
    .select("backfill_page, backfill_done")
    .eq("source", source)
    .maybeSingle();

  if (error) throw error;
  return {
    nextPage: Math.max(Number(data?.backfill_page || from), from),
    done: Boolean(data?.backfill_done),
  };
}

async function run() {
  ({ supabaseAdmin } = await import("../src/lib/supabase/admin"));
  ({ MovieIndexerService } = await import("../src/services/admin-movie-indexer/indexer.service"));

  const options = parseArgs();
  const progress = new Map<MovieSource, { nextPage: number; done: boolean }>();
  const totals = new Map<MovieSource, PageSummary>();

  for (const source of options.sources) {
    if (options.reset) await resetSourceState(source, options.from);
    progress.set(source, await getSourceState(source, options.from));
    totals.set(source, { insert: 0, update: 0, skip: 0, review: 0 });
  }

  while (Array.from(progress.values()).some((state) => !state.done)) {
    for (const source of options.sources) {
      const state = progress.get(source);
      if (!state || state.done) continue;

      for (const page of nextBatchPages(state.nextPage, options.pagesPerBatch)) {
        console.log(`[${source}] page ${page}`);
        try {
          const results = await MovieIndexerService.indexSourcePage(source, page);
          if (results.length === 0) {
            state.done = true;
            await updateSourceProgress(source, page, true);
            console.log(`[${source}] done at empty page ${page}`);
            break;
          }

          const pageSummary = summarizePageResults(results);
          totals.set(source, addPageSummary(totals.get(source)!, pageSummary));
          state.nextPage = page + 1;
          await updateSourceProgress(source, state.nextPage, false);
          console.log(`[${source}] page ${page} result`, pageSummary, "total", totals.get(source));
          await sleep(PAGE_DELAY_MS);
        } catch (error) {
          await markSourceError(source, error);
          throw error;
        }
      }
    }
  }

  console.log("Full crawl complete", Object.fromEntries(totals));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
