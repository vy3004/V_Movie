"use client";

import { useState } from "react";
import { PlusIcon, QueueListIcon } from "@heroicons/react/24/outline";
import ImageCustom from "@/components/ImageCustom";
import PlaylistSearch from "@/components/watch-party/PlaylistSearch";
import PlaylistItemRow from "@/components/watch-party/PlaylistItemRow";
import { usePlaylistManager } from "@/hooks/useWatchParty";
import { WatchPartyRoom } from "@/types";

interface PlaylistTabProps {
  room: WatchPartyRoom;
  canManage: boolean;
}

export default function PlaylistTab({ room, canManage }: PlaylistTabProps) {
  const [isAdding, setIsAdding] = useState(false);

  const {
    playlist,
    handleAddMovie,
    handlePlayNow,
    handleDeleteItem,
    handleDragStart,
    handleDragEnter,
    handleDragEnd,
  } = usePlaylistManager(room);

  return (
    <div className="h-full flex flex-col">
      {/* --- HEADER --- */}
      <div className="flex justify-between items-center mb-4 px-1">
        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
          Danh sách phát
        </h3>
        {canManage && (
          <button
            onClick={() => setIsAdding(!isAdding)}
            aria-label={isAdding ? "Đóng tìm kiếm" : "Thêm phim vào playlist"}
            aria-expanded={isAdding}
            className={`p-2 rounded-xl transition shadow-lg ${
              isAdding
                ? "bg-red-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            <PlusIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* --- KHUNG TÌM KIẾM (Chỉ hiện khi bấm nút +) --- */}
      {isAdding && (
        <PlaylistSearch
          onAdd={(m) => handleAddMovie(m, () => setIsAdding(false))}
        />
      )}

      {/* --- KHU VỰC DANH SÁCH CHÍNH --- */}
      <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1 pb-10">
        {/* 1. THẺ ĐANG CHIẾU (NOW PLAYING) */}
        {room.current_movie_slug && (
          <div className="group relative flex items-center gap-3 p-3 bg-red-950/20 rounded-2xl border border-red-900/30">
            <div className="relative shrink-0 overflow-hidden rounded-xl border border-red-500/20">
              <ImageCustom
                className="w-12 h-16 object-cover opacity-90"
                src={room.movie_image || ""}
                alt="Đang chiếu"
                widths={[72]}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-1.5 py-0.5 bg-red-600/20 text-red-500 text-[8px] font-black uppercase rounded shadow-sm flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping absolute" />
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full relative" />{" "}
                  Live
                </span>
              </div>
              <p className="text-[12px] font-bold text-white truncate leading-tight">
                Phim đang chiếu
              </p>
            </div>
          </div>
        )}

        {/* 2. ĐƯỜNG PHÂN CÁCH (Chỉ hiện nếu có phim trong hàng đợi) */}
        {playlist.length > 0 && (
          <div className="flex items-center gap-2 py-1 opacity-50">
            <div className="h-px bg-zinc-800 flex-1" />
            <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">
              Tiếp theo
            </span>
            <div className="h-px bg-zinc-800 flex-1" />
          </div>
        )}

        {/* 3. TRẠNG THÁI RỖNG */}
        {playlist.length === 0 && !isAdding && (
          <div className="h-32 flex flex-col items-center justify-center text-zinc-700 text-xs italic text-center">
            <QueueListIcon className="w-8 h-8 mb-2 opacity-20" /> Hàng đợi
            trống...
          </div>
        )}

        {/* 4. VÒNG LẶP RENDER HÀNG ĐỢI KÉO THẢ */}
        {playlist.map((item, index) => (
          <PlaylistItemRow
            key={item.id}
            item={item}
            index={index}
            canManage={canManage}
            onPlay={handlePlayNow}
            onDelete={handleDeleteItem}
            onDragStart={handleDragStart}
            onDragEnter={handleDragEnter}
            onDragEnd={handleDragEnd}
          />
        ))}
      </div>
    </div>
  );
}
