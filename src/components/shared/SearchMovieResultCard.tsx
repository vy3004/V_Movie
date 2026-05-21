import ImageCustom from "@/components/ui/ImageCustom";
import { getSourceBadge } from "@/services/movie-sources/utils";
import type { Movie, MovieSource } from "@/types";

type SearchMovieResultCardProps = {
  movie: Pick<
    Movie,
    | "name"
    | "origin_name"
    | "year"
    | "thumb_url"
    | "episode_current"
    | "quality"
    | "lang"
  > & {
    sources?: MovieSource[];
  };
  active?: boolean;
  showEnterHint?: boolean;
  className?: string;
};

export default function SearchMovieResultCard({
  movie,
  active = false,
  showEnterHint = false,
  className = "",
}: SearchMovieResultCardProps) {
  return (
    <div
      className={`flex min-w-0 gap-3 rounded-xl border border-transparent p-2 transition-all ${active ? "border-red-500 bg-zinc-800/50 shadow-lg" : ""} ${className}`}
    >
      <div className="relative aspect-[3/4] w-12 shrink-0 overflow-hidden rounded-lg bg-zinc-900 shadow-md ring-1 ring-zinc-800 sm:w-14">
        <ImageCustom
          alt={movie.name}
          src={movie.thumb_url}
          widths={[96, 128]}
          className="absolute inset-0 size-full object-cover"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <h3
          className={`line-clamp-1 text-sm font-bold ${active ? "text-primary" : "text-zinc-100"}`}
        >
          {movie.name}
        </h3>
        <p
          className={`line-clamp-1 text-xs ${active ? "text-indigo-100" : "text-zinc-500"}`}
        >
          {movie.origin_name} • {movie.year || "-"}
        </p>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
          {movie.sources?.length ? (
            <span className="rounded-lg bg-zinc-800 px-2 py-0.5 text-[10px] font-black text-zinc-300">
              {getSourceBadge(movie.sources[0])}
              {movie.sources.length > 1 ? ` +${movie.sources.length - 1}` : ""}
            </span>
          ) : null}
          {movie.episode_current ? (
            <span className="rounded-lg bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-300">
              {movie.episode_current}
            </span>
          ) : null}
          <span className="truncate text-[10px] text-zinc-400">
            {movie.quality || "-"} • {movie.lang || "-"}
          </span>
        </div>
      </div>
      {showEnterHint ? (
        <div className="hidden items-center pr-2 sm:flex">
          <span className="rounded bg-white/20 px-2 py-1 text-[10px] font-black uppercase text-white">
            Enter
          </span>
        </div>
      ) : null}
    </div>
  );
}
