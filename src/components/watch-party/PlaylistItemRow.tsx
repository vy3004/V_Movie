import { PlayIcon, TrashIcon } from "@heroicons/react/24/outline";
import ImageCustom from "@/components/ImageCustom";
import { PlaylistItem } from "@/types";

interface PlaylistItemRowProps {
  item: PlaylistItem;
  index: number;
  canManage: boolean;
  onPlay: (item: PlaylistItem) => void;
  onDelete: (id: string) => void;
  // Kéo thả Props
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragEnter: (e: React.DragEvent, index: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
}

export default function PlaylistItemRow({
  item,
  index,
  canManage,
  onPlay,
  onDelete,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: PlaylistItemRowProps) {
  return (
    <div
      draggable={canManage}
      onDragStart={(e) => canManage && onDragStart(e, index)}
      onDragEnter={(e) => canManage && onDragEnter(e, index)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      className={`group relative flex items-center gap-3 p-3 bg-zinc-900/40 rounded-2xl border border-zinc-800/50 hover:bg-zinc-800/40 transition-all duration-300 ${
        canManage ? "cursor-grab active:cursor-grabbing" : ""
      }`}
    >
      <div className="relative shrink-0 overflow-hidden rounded-xl">
        <ImageCustom
          className="w-12 h-16 object-cover shadow-lg group-hover:scale-110 transition-transform duration-500"
          src={item.thumb_url}
          alt={item.movie_name}
          widths={[72]}
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
            onClick={() => onPlay(item)}
            className="p-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-xl transition shadow-sm"
            title="Phát ngay"
          >
            <PlayIcon className="w-4 h-4 fill-current" />
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition shadow-sm"
            title="Xóa khỏi hàng đợi"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
