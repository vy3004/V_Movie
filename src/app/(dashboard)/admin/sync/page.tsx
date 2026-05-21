import { getSyncDashboard } from "@/services/admin-movie-indexer/admin.service";
import SyncSourceActions from "@/app/(dashboard)/admin/sync/_components/SyncSourceActions";

export default async function AdminSyncPage() {
  const { states, jobs } = await getSyncDashboard();
  const activeStates = states;

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.4em] text-red-500">
          Movie Index Worker
        </p>
        <h1 className="mt-2 text-3xl font-black text-white">Sync Control</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-500">
          Chạy sync tay theo đúng khoảng page cần cào, hoặc queue job nền từ page hiện tại.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {activeStates.map((state) => (
          <div
            key={state.source}
            className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-5 shadow-2xl shadow-black/30"
          >
            <div className="flex items-center justify-between">
              <span className="text-lg font-black uppercase text-white">{state.source}</span>
              <span className={state.paused ? "text-amber-400" : "text-emerald-400"}>
                {state.paused ? "Paused" : "Active"}
              </span>
            </div>
            <div className="mt-5 grid gap-2 text-sm text-zinc-400">
              <div className="grid grid-cols-2 gap-2">
                <span className="rounded-2xl bg-black/30 px-3 py-2">Mode: {state.mode}</span>
                <span className="rounded-2xl bg-black/30 px-3 py-2">Next page: {state.backfill_page || 1}</span>
                <span className="rounded-2xl bg-black/30 px-3 py-2">Done: {String(state.backfill_done)}</span>
                <span className="rounded-2xl bg-black/30 px-3 py-2">Manual max: 20 pages</span>
              </div>
              <p className="truncate rounded-2xl bg-red-950/20 px-3 py-2 text-red-300">
                {state.last_error || "No errors"}
              </p>
            </div>
            <SyncSourceActions
              source={state.source}
              page={state.backfill_page || 1}
              paused={state.paused}
            />
          </div>
        ))}
      </div>

      <section className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-5">
        <h2 className="text-xl font-black text-white">Recent Jobs</h2>
        <div className="mt-4 divide-y divide-zinc-800 text-sm">
          {jobs.length === 0 ? (
            <div className="py-8 text-center font-bold text-zinc-500">
              No sync jobs yet
            </div>
          ) : null}
          {jobs.map((job) => (
            <div key={job.id} className="grid grid-cols-5 gap-4 py-3 text-zinc-300">
              <span className="font-bold uppercase">{job.source}</span>
              <span>{job.mode}</span>
              <span>
                {job.page_start}-{job.page_end}
              </span>
              <span>{job.status}</span>
              <span className="truncate text-red-300">{job.last_error || ""}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

