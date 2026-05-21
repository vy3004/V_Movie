import Link from "next/link";
import { getReviewQueue } from "@/services/admin-movie-indexer/admin.service";

export default async function AdminReviewsPage() {
  let reviews;
  try {
    reviews = await getReviewQueue();
  } catch {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.4em] text-amber-400">Duplicate Control</p>
          <h1 className="mt-2 text-3xl font-black text-white">Review Queue</h1>
        </div>
        <div className="rounded-3xl border border-red-800 bg-red-950/20 p-6 text-center text-sm font-bold text-red-300">
          Failed to load review queue
        </div>
      </div>
    );
  }

  const highRiskCount = reviews.filter((review) => Number(review.confidence_score) < 75).length;
  const readyCount = reviews.filter((review) => Number(review.confidence_score) >= 75).length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.4em] text-amber-400">Duplicate Control</p>
        <h1 className="mt-2 text-3xl font-black text-white">Review Queue</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <p className="text-zinc-500">Pending</p>
          <p className="text-3xl font-black">{reviews.length}</p>
        </div>
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <p className="text-zinc-500">High risk</p>
          <p className="text-3xl font-black">{highRiskCount}</p>
        </div>
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <p className="text-zinc-500">Ready</p>
          <p className="text-3xl font-black">{readyCount}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950/70">
        {reviews.length === 0 ? (
          <div className="p-8 text-center text-sm font-bold text-zinc-500">
            No reviews pending
          </div>
        ) : null}
        {reviews.map((review) => (
          <Link
            key={review.id}
            href={`/admin/reviews/${review.id}`}
            className="grid grid-cols-[1fr_120px_160px] gap-4 border-b border-zinc-900 p-4 text-sm transition last:border-0 hover:bg-zinc-900/60"
          >
            <span className="font-bold text-white">{review.reason}</span>
            <span className="text-amber-300">{Number(review.confidence_score)}%</span>
            <span className="text-zinc-500">Open review</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
