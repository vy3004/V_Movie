import Link from "next/link";
import type { MovieCollectionResult } from "@/services/movie-collections.service";

export default function MovieCollectionSection({
  collection,
}: {
  collection: MovieCollectionResult | null;
}) {
  if (!collection || collection.items.length <= 1) return null;

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 sm:p-6">
      <div className="mb-4">
        <p className="text-xs font-black uppercase tracking-[0.35em] text-red-500">
          Bộ sưu tập
        </p>
        <h2 className="mt-2 text-xl font-black text-white">
          {collection.name}
        </h2>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {collection.items.map((item) => (
          <Link
            key={item.movie_id}
            href={`/phim/${item.slug}`}
            className={
              item.isCurrent
                ? "shrink-0 rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white"
                : "shrink-0 rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm font-bold text-zinc-300 transition hover:border-red-500 hover:text-white"
            }
          >
            <span className="block text-[10px] uppercase tracking-widest opacity-70">
              {item.item_type}
            </span>
            {item.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
