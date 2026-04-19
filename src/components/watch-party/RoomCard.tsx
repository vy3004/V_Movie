"use client";

import { UserGroupIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import ImageCustom from "@/components/ImageCustom";
import { WatchPartyRoom } from "@/types";

export default function RoomCard({ room }: { room: WatchPartyRoom }) {
  // Thay url này bằng link ảnh default nếu phòng không có ảnh phim
  const bgImage =
    room.movie_image ||
    "https://images.unsplash.com/photo-1574267432553-4b4628081c31?q=80&w=1000&auto=format&fit=crop";
  const participantsCount = room.participants?.[0]?.count || 1;
  const maxLimit = room.max_participants || 50;
  const isFull = participantsCount >= maxLimit;

  return (
    <Link
      href={isFull && !room.is_private ? "#" : `/xem-chung/${room.room_code}?`}
      className={isFull ? "pointer-events-none opacity-50" : ""}
    >
      <div className="group relative aspect-video rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 hover:border-red-600 transition-all duration-300 hover:scale-105 shadow-lg cursor-pointer">
        {/* Background Image */}
        <ImageCustom
          className="absolute inset-0 object-cover size-full rounded-xl group-hover:opacity-40 transition-opacity"
          src={bgImage}
          alt={room.title}
          widths={[400]}
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent rounded-xl" />

        {/* Top Badges */}
        <div className="absolute top-2 w-full px-2 flex justify-between items-center">
          <span className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md text-xs font-bold text-white uppercase tracking-wider border border-zinc-700">
            Mã: {room.room_code}
          </span>
          {room.is_private && (
            <span className="bg-red-600 text-white p-1.5 rounded-md shadow-md">
              <LockClosedIcon className="w-4 h-4" />
            </span>
          )}
        </div>

        {/* Content Bottom */}
        <div className="absolute bottom-0 w-full p-2 flex flex-col justify-end">
          <h3 className="text-white font-bold text-md leading-tight line-clamp-1 group-hover:text-red-500 transition-colors">
            {room.title}
          </h3>

          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-2">
              <ImageCustom
                className="w-6 h-6 rounded-full border border-zinc-500"
                src={room.host?.avatar_url || "/default-avatar.png"}
                alt={room.host?.full_name || "Host"}
                widths={[36]}
              />
              <span className="text-xs text-zinc-400 font-medium truncate max-w-[100px]">
                {room.host?.full_name}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-300 ml-auto bg-black/40 px-2 py-1 rounded-full">
              <UserGroupIcon
                className={`w-4 h-4 ${isFull ? "text-red-500" : "text-emerald-400"} `}
              />
              <span>
                {participantsCount}/{maxLimit}
              </span>
            </div>
          </div>
        </div>

        {/* Hover Play Icon Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="bg-red-600 text-white rounded-full p-3 shadow-xl transform scale-75 group-hover:scale-100 transition-transform">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M8 5V19L19 12L8 5Z" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}
