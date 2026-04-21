"use client";

import { useInView } from "react-intersection-observer";
import { useEffect } from "react";
import {
  MagnifyingGlassIcon,
  PlusIcon,
  ArrowPathIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useMovieSearch } from "@/hooks/useMovieSearch";
import ImageCustom from "@/components/ImageCustom";
import { Movie } from "@/types";

interface PlaylistSearchProps {
  onAdd: (movie: Movie) => void;
}

export default function PlaylistSearch({ onAdd }: PlaylistSearchProps) {
  const {
    query,
    setQuery,
    handleSearchChange,
    movies,
    setIsOpen,
    isOpen,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useMovieSearch(10);

  const { ref: loadMoreRef, inView } = useInView();

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="mb-4 relative z-[70] animate-in fade-in slide-in-from-top-2">
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />

        <input
          value={query}
          onChange={handleSearchChange}
          onClick={() => setIsOpen(true)}
          placeholder="Tìm phim thêm vào hàng đợi..."
          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 pl-10 pr-10 text-xs focus:border-red-600 outline-none shadow-inner transition-colors"
        />

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
          {isLoading ? (
            <ArrowPathIcon className="w-4 h-4 text-zinc-500 animate-spin mr-1" />
          ) : query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setIsOpen(false);
              }}
              className="p-1.5 hover:bg-zinc-800 rounded-full transition-colors"
            >
              <XMarkIcon className="w-4 h-4 text-zinc-400" />
            </button>
          ) : null}
        </div>
      </div>

      {isOpen && query && (
        <div className="absolute top-full mt-2 w-full bg-zinc-900 border border-zinc-800 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden max-h-60 overflow-y-auto custom-scrollbar z-[80]">
          {isLoading ? (
            <div className="flex flex-col">
              {[1, 2, 3, 4].map((i) => (
                <SearchSkeleton key={`initial-${i}`} />
              ))}
            </div>
          ) : movies.length > 0 ? (
            <>
              {movies.map((m: Movie) => (
                <div
                  key={m._id}
                  onClick={() => onAdd(m)}
                  className="flex items-center gap-3 p-3 hover:bg-zinc-800 cursor-pointer transition border-b border-zinc-800/50 last:border-0 group"
                >
                  <ImageCustom
                    className="w-9 h-12 object-cover rounded-lg shadow group-hover:scale-105 transition shrink-0"
                    src={m.thumb_url || m.poster_url}
                    alt={m.slug}
                    widths={[54]}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-zinc-200 truncate">
                      {m.name}
                    </p>
                    <p className="text-[10px] text-zinc-500 truncate">
                      {m.year}
                    </p>
                  </div>
                  <PlusIcon className="w-4 h-4 text-zinc-600 group-hover:text-red-500 shrink-0 mr-1" />
                </div>
              ))}

              {isFetchingNextPage && (
                <div className="flex flex-col">
                  {[1, 2].map((i) => (
                    <SearchSkeleton key={`more-${i}`} />
                  ))}
                </div>
              )}

              {!isFetchingNextPage && hasNextPage && (
                <div ref={loadMoreRef} className="h-4" />
              )}
            </>
          ) : (
            <div className="p-5 text-center">
              <p className="text-xs text-zinc-500 italic">
                Không tìm thấy phim nào khớp với <br />
                <strong className="text-zinc-400">&ldquo;{query}&rdquo;</strong>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const SearchSkeleton = () => (
  <div className="flex items-center gap-3 p-3 border-b border-zinc-800/50 last:border-0">
    <div className="w-9 h-12 bg-zinc-800 rounded-lg animate-pulse shrink-0" />
    <div className="flex-1 min-w-0 space-y-2">
      <div className="h-3 bg-zinc-800 rounded w-2/3 animate-pulse" />
      <div className="h-2 bg-zinc-800 rounded w-1/3 animate-pulse" />
    </div>
    <div className="w-4 h-4 bg-zinc-800 rounded-full animate-pulse shrink-0" />
  </div>
);
