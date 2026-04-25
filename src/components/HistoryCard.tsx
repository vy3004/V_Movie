"use client";

import Link from "next/link";
import ImageCustom from "@/components/ImageCustom";
import { formatDuration } from "@/lib/utils";
import { HistoryItem } from "@/types";

interface HistoryCardProps {
  item: HistoryItem;
  type: "watching" | "finished";
}

export default function HistoryCard({ item, type }: HistoryCardProps) {
  const movieSlug = item.movie_slug || item.movie_slug;
  const movieName = item.movie_name || item.movie_name;
  const moviePoster = item.movie_poster || item.movie_poster;
  const lastTapSlug = item.last_episode_slug || item.last_episode_slug;

  // Lấy tiến trình của tập hiện tại từ object JSONB
  const progressData = item.episodes_progress?.[lastTapSlug] || {};
  const lastTime = progressData.ep_last_time || 0;
  const duration = progressData.ep_duration || 1; // Tránh chia cho 0
  const progressPercent = Math.min((lastTime / duration) * 100, 100);

  return (
    <div className="group relative space-y-2">
      {/* Phần ảnh và Progress Bar */}
      <div className="relative aspect-video rounded-lg overflow-hidden bg-zinc-900 border border-white/5 shadow-md">
        <Link href={`/phim/${movieSlug}?tap=${lastTapSlug}`} prefetch={false}>
          <ImageCustom
            src={moviePoster}
            alt={movieName}
            widths={[320, 480, 640]}
            sizes="(max-width: 640px) 70vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            loading="lazy"
            className="absolute inset-0 object-cover size-full group-hover:scale-105 transition duration-500"
          />
          {/* Lớp phủ Gradient mờ */}
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>

        {/* Thanh Progress Bar đỏ (chỉ hiện khi đang xem dở) */}
        {type === "watching" && (
          <div className="absolute bottom-0 left-0 w-full h-1 bg-white/20 z-10">
            <div
              className="h-full bg-red-600 shadow-[0_0_8px_#e50914]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </div>

      {/* Thông tin chữ bên dưới */}
      <div className="space-y-1 px-1">
        {type === "watching" && (
          <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 tracking-tight capitalize">
            <span>Tập {lastTapSlug.replace(/\D/g, "") || lastTapSlug}</span>
            <span>•</span>
            <span>
              {formatDuration(lastTime)} / {formatDuration(duration)}
            </span>
          </div>
        )}
        <Link href={`/phim/${movieSlug}`} prefetch={false}>
          <h3 className="line-clamp-1 text-sm font-semibold text-zinc-200 group-hover:text-primary transition-colors">
            {movieName}
          </h3>
        </Link>
      </div>
    </div>
  );
}
