import { getMergeHistory } from "@/services/admin-movie-indexer/admin.service";

export default async function AdminMergeLogPage() {
  let rows;
  try {
    rows = await getMergeHistory();
  } catch {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.4em] text-zinc-500">Audit Trail</p>
          <h1 className="mt-2 text-3xl font-black text-white">Merge Log</h1>
        </div>
        <div className="rounded-3xl border border-red-800 bg-red-950/20 p-6 text-center text-sm font-bold text-red-300">
          Failed to load merge history
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.4em] text-zinc-500">Audit Trail</p>
        <h1 className="mt-2 text-3xl font-black text-white">Merge Log</h1>
      </div>

      <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950/70">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm font-bold text-zinc-500">
            No merge history found
          </div>
        ) : null}
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[160px_120px_1fr] gap-4 border-b border-zinc-900 p-4 text-sm text-zinc-300 last:border-0"
          >
            <span>{new Date(row.created_at).toLocaleString("vi-VN")}</span>
            <span className="font-black text-white">{row.action}</span>
            <span className="truncate text-zinc-500">{row.review_id || row.movie_id}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
