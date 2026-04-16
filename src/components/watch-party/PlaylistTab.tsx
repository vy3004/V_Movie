"use client";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import { useMovieSearch } from "@/hooks/useMovieSearch";
import {
  PlusIcon,
  TrashIcon,
  PlayIcon,
  MagnifyingGlassIcon,
  QueueListIcon,
} from "@heroicons/react/24/outline";
import { createSupabaseClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function PlaylistTab({ room, canManage }: any) {
  const queryClient = useQueryClient();
  const supabase = createSupabaseClient();
  const [isAdding, setIsAdding] = useState(false);

  const {
    query,
    handleSearchChange,
    movies,
    setIsOpen,
    isOpen,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMovieSearch(10);
  const { ref: loadMoreRef, inView } = useInView();

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const { data: playlist = [] } = useQuery({
    queryKey: ["wp-playlist", room.id],
    queryFn: () =>
      fetch(`/api/watch-party/playlist?roomId=${room.id}`).then((res) =>
        res.json(),
      ),
  });

  const broadcastUpdate = () => {
    supabase.channel(`wp_engine_${room.id}`).send({
      type: "broadcast",
      event: "playlist_updated",
      payload: {},
    });
    queryClient.invalidateQueries({ queryKey: ["wp-playlist", room.id] });
  };

  const addMovie = async (movie: any) => {
    const res = await fetch("/api/watch-party/playlist", {
      method: "POST",
      body: JSON.stringify({
        roomId: room.id,
        movieSlug: movie.slug,
        movieName: movie.name,
        thumbUrl: movie.poster_url || movie.thumb_url,
        episodeSlug: "tap-1",
      }),
    });
    if (res.ok) {
      toast.success("Đã thêm vào danh sách phát");
      setIsAdding(false);
      broadcastUpdate();
    }
  };

  const playNow = async (item: any) => {
    const { error } = await supabase
      .from("watch_party_rooms")
      .update({
        current_movie_slug: item.movie_slug,
        current_episode_slug: item.episode_slug,
        movie_image: item.thumb_url,
      })
      .eq("id", room.id);
    if (!error) toast.success(`Đang chuyển sang: ${item.movie_name}`);
  };

  const deleteItem = async (id: string) => {
    const res = await fetch(`/api/watch-party/playlist?id=${id}`, {
      method: "DELETE",
    });
    if (res.ok) broadcastUpdate();
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-5 px-1">
        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
          Danh sách chờ
        </h3>
        {canManage && (
          <button
            onClick={() => setIsAdding(!isAdding)}
            className={`p-2 rounded-xl transition shadow-lg ${isAdding ? "bg-red-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}
          >
            <PlusIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {isAdding && (
        <div className="mb-4 relative z-[70] animate-in fade-in slide-in-from-top-2">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              value={query}
              onChange={handleSearchChange}
              onClick={() => setIsOpen(true)}
              placeholder="Thêm phim vào hàng đợi..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 pl-10 pr-3 text-xs focus:border-red-600 outline-none shadow-inner"
            />
          </div>
          {isOpen && query && (
            <div className="absolute top-full mt-2 w-full bg-zinc-900 border border-zinc-800 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden max-h-60 overflow-y-auto custom-scrollbar z-[80]">
              {movies.map((m: any) => (
                <div
                  key={m._id}
                  onClick={() => addMovie(m)}
                  className="flex items-center gap-3 p-3 hover:bg-zinc-800 cursor-pointer transition border-b border-zinc-800/50 last:border-0 group"
                >
                  <img
                    src={m.poster_url || m.thumb_url}
                    className="w-9 h-12 object-cover rounded-lg shadow group-hover:scale-105 transition"
                    alt=""
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-zinc-200 truncate">
                      {m.name}
                    </p>
                    <p className="text-[10px] text-zinc-500 truncate">
                      {m.year}
                    </p>
                  </div>
                  <PlusIcon className="w-4 h-4 text-zinc-600 group-hover:text-red-500 mr-1" />
                </div>
              ))}
              {hasNextPage && <div ref={loadMoreRef} className="h-4" />}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1 pb-10">
        {playlist.length === 0 && !isAdding && (
          <div className="h-40 flex flex-col items-center justify-center text-zinc-700 text-xs italic text-center">
            <QueueListIcon className="w-8 h-8 mb-2 opacity-20" />
            Trống rỗng...
            <br />
            Hãy thêm phim để xem tiếp!
          </div>
        )}
        {playlist.map((item: any) => (
          <div
            key={item.id}
            className="group relative flex items-center gap-3 p-3 bg-zinc-900/40 rounded-2xl border border-zinc-800/50 hover:bg-zinc-800/40 transition-all duration-300"
          >
            <div className="relative shrink-0 overflow-hidden rounded-xl">
              <img
                src={item.thumb_url}
                className="w-12 h-16 object-cover shadow-lg group-hover:scale-110 transition-transform duration-500"
                alt=""
              />
              <div className="absolute inset-0 bg-black/20" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold text-zinc-200 truncate leading-tight mb-1">
                {item.movie_name}
              </p>
              <p className="text-[9px] text-zinc-500 truncate flex items-center gap-1">
                <span className="w-1 h-1 bg-zinc-700 rounded-full" /> Bởi{" "}
                {item.profiles?.full_name || "Thành viên"}
              </p>
            </div>
            {canManage && (
              <div className="hidden group-hover:flex items-center gap-1.5 shrink-0 animate-in fade-in slide-in-from-right-2">
                <button
                  onClick={() => playNow(item)}
                  className="p-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-xl transition shadow-sm"
                >
                  <PlayIcon className="w-4 h-4 fill-current" />
                </button>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition shadow-sm"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
