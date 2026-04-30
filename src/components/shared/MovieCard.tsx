"use client";

import Link from "next/link";
import ImageCustom from "@/components/ui/ImageCustom";
import { MovieRecommendation } from "@/types";

export default function MovieCard({
  movie_slug,
  name,
  thumb_url,
  episode_current,
  reason,
}: MovieRecommendation) {
  return (
    <Link
      href={`/phim/${movie_slug}`}
      prefetch={false}
      className="space-y-2 relative group flex flex-col h-full"
    >
      {/* ========================================== */}
      {/* PHẦN 1: ẢNH POSTER VÀ HIỆU ỨNG TRÊN DESKTOP  */}
      {/* ========================================== */}
      <div className="relative aspect-[3/4] w-full rounded-lg overflow-hidden shrink-0">
        <ImageCustom
          src={thumb_url}
          alt={name}
          widths={[256, 384, 512, 640]}
          sizes="(max-width: 640px) 46vw, (max-width: 768px) 33.33vw, (max-width: 1024px) 25vw, 16.67vw"
          loading="lazy"
          className="absolute inset-0 object-cover size-full group-hover:scale-110 transition duration-500 ease-in-out"
        />

        {/* BADGE TẬP PHIM */}
        <div className="absolute right-2 top-2 bg-black/80 rounded-lg px-2 py-1 flex items-center gap-1 text-xs text-primary capitalize group-hover:text-main font-semibold shadow-md z-10">
          {episode_current}
        </div>

        {/* OVERLAY LÝ DO: CHỈ HIỆN TRÊN DESKTOP (md:flex) */}
        {reason && (
          <div className="hidden md:flex absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex-col justify-end p-3 pointer-events-none">
            <p className="text-[13px] text-white/95 font-medium translate-y-4 group-hover:translate-y-0 transition-transform duration-300 drop-shadow-md">
              <span className="italic leading-relaxed">{reason}</span>
            </p>
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* PHẦN 2: THÔNG TIN PHIM VÀ LÝ DO TRÊN MOBILE  */}
      {/* ========================================== */}
      <div className="flex-1 flex flex-col justify-start mt-1">
        <div className="line-clamp-2 group-hover:text-main group-hover:font-semibold font-medium text-sm md:text-base transition-colors">
          {name}
        </div>

        {/* TEXT LÝ DO: CHỈ HIỆN TRÊN MOBILE (flex md:hidden) */}
        {reason && (
          <div className="flex md:hidden mt-1.5 items-start gap-1.5 text-[11px] text-gray-400">
            <span className="leading-relaxed">{reason}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
