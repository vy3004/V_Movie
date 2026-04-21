"use client";

import {
  UserGroupIcon,
  LockClosedIcon,
  PlayCircleIcon,
  GlobeAltIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import ImageCustom from "@/components/ImageCustom";
import UserAvatar from "@/components/UserAvatar";
import { WatchPartyRoom } from "@/types";

export default function RoomCard({ room }: { room: WatchPartyRoom }) {
  const bgImage =
    room.movie_image ||
    "https://images.unsplash.com/photo-1574267432553-4b4628081c31?q=80&w=1000&auto=format&fit=crop";
  const participantsCount = room.participant_count || 0;
  const maxLimit = room.max_participants || 50;
  const isFull = participantsCount >= maxLimit;

  return (
    <Link
      href={isFull ? "#" : `/xem-chung/${room.room_code}`}
      className={`group relative bg-[#111] rounded-xl overflow-hidden border border-white/5 hover:border-red-600/30 transition-all duration-500 block ${
        isFull ? "opacity-50 pointer-events-none" : ""
      }`}
    >
      {/* --- PHẦN BADGES TRÊN CÙNG --- */}
      <div className="absolute top-4 left-4 right-4 z-20 flex justify-between items-center">
        {/* Số lượng người bên trái */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-black/60 backdrop-blur-md rounded-full border border-white/5 text-[10px] font-black text-zinc-200">
          <UserGroupIcon
            className={`size-4 stroke-[3px] ${isFull ? "text-red-500" : "text-emerald-500"}`}
          />
          <span>
            {participantsCount}/{maxLimit}
          </span>
        </div>

        {/* Icon Private/Public bên phải */}
        {room.is_private ? (
          <div className="p-2 bg-black/60 backdrop-blur-md rounded-full text-red-600 border border-white/5">
            <LockClosedIcon className="size-4" />
          </div>
        ) : (
          <div className="p-2 bg-black/60 backdrop-blur-md rounded-full text-zinc-400 border border-white/5">
            <GlobeAltIcon className="size-4" />
          </div>
        )}
      </div>

      {/* Thumbnail Area - Aspect 21/9 */}
      <div className="aspect-[21/9] relative overflow-hidden">
        <ImageCustom
          className="w-full h-full object-cover rounded-xl transition-all duration-700 scale-105 group-hover:scale-110"
          src={bgImage}
          alt={room.title}
          widths={[500]}
        />
        {/* Lớp phủ khói đen mờ dưới chữ */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-transparent to-black/20" />
      </div>

      {/* Room Details Area */}
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-zinc-200 line-clamp-1 text-sm">
            {room.title}
          </h3>
        </div>

        <div className="flex items-center gap-3">
          {/* Host Avatar */}
          <UserAvatar avatar_url={room.host?.avatar_url} size={32} />

          <div className="flex-1">
            <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest leading-none mb-0.5">
              Chủ phòng
            </p>
            <p className="text-xs font-bold text-zinc-400 truncate max-w-[120px]">
              {room.host?.full_name || "Ẩn danh"}
            </p>
          </div>

          {/* Nút Play thay thế motion bằng CSS transition */}
          <div className="h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-red-600 group-hover:border-red-600 group-hover:text-white transition-all text-zinc-400">
            <PlayCircleIcon className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Số Index mờ phía dưới (Dùng Room Code hoặc ID) */}
      <div className="absolute -bottom-4 -left-2 text-6xl font-black text-white/[0.02] select-none pointer-events-none group-hover:text-red-600/[0.05] transition-colors">
        #{room.room_code}
      </div>
    </Link>
  );
}
