// import { createClient } from "jsr:@supabase/supabase-js@2";

// const PAGES_PER_JOB = 5;
// const ENABLED_SOURCES = ["ophim", "phimapi"];

// Deno.serve(async () => {
//   const supabase = createClient(
//     Deno.env.get("SUPABASE_URL") ?? "",
//     Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
//   );

//   const { data: states, error } = await supabase
//     .from("movie_index_state")
//     .select("*")
//     .eq("paused", false)
//     .in("source", ENABLED_SOURCES);

//   if (error) return new Response(error.message, { status: 500 });

//   for (const state of states || []) {
//     const pageStart = state.backfill_done ? 1 : state.backfill_page;
//     await supabase.from("movie_index_jobs").insert({
//       source: state.source,
//       mode: state.backfill_done ? "incremental" : "backfill",
//       page_start: pageStart,
//       page_end: pageStart + PAGES_PER_JOB - 1,
//       status: "queued",
//       created_by: "cron",
//     });
//   }

//   const workerUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/worker-index-movies`;
//   const workerResponse = await fetch(workerUrl, {
//     method: "POST",
//     headers: {
//       Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
//       "Content-Type": "application/json",
//     },
//   });
//   if (!workerResponse.ok) {
//     console.error(`Failed to trigger worker: ${workerResponse.status}`);
//   }

//   return new Response("Movie index jobs dispatched");
// });
