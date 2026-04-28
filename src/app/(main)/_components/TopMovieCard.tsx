"use client";

import Link from "next/link";
import ImageCustom from "@/components/ui/ImageCustom";
import { Movie } from "@/types";

interface MovieCardProps {
  movie: Movie;
  rank: number;
}

export default function MovieCard({ movie, rank }: MovieCardProps) {
  const metaInfo = [movie.year, movie.lang].filter(Boolean).join(" • ");

  const badgeText = movie.quality
    ? `${movie.quality}${
        movie.episode_current && movie.episode_current !== "Full"
          ? ` | ${movie.episode_current}`
          : ""
      }`
    : "";

  // Kiểm tra thứ tự Chẵn / Lẻ
  const isEvenRank = rank != null ? rank % 2 === 0 : false;

  const skewClass = isEvenRank ? "-skew-y-[4deg]" : "skew-y-[4deg]";
  const unSkewClass = isEvenRank ? "skew-y-[4deg]" : "-skew-y-[4deg]";
  const transformOrigin = isEvenRank ? "origin-top-right" : "origin-top-left";

  return (
    <Link
      href={`/phim/${movie.slug}`}
      className="flex flex-col group w-full relative"
    >
      {/* KHỐI POSTER - THE OUTER (Quyết định cái đáy thẳng ngang) 
        Bo tròn chuẩn rounded-lg và cắt bỏ mọi thứ dư thừa 
      */}
      <div className="relative aspect-[2/3] w-full rounded-lg overflow-hidden shadow-md z-10">
        {/* KHỐI LÀM NGHIÊNG - THE INNER (Quyết định cái đỉnh chéo) 
          Được làm cao 120% để phần viền xéo bên dưới bị đẩy ra ngoài và bị Outer cắt thẳng 
        */}
        <div
          className={`absolute top-0 inset-x-0 h-[120%] rounded-lg overflow-hidden ${skewClass} ${transformOrigin}`}
        >
          {/* KHỐI CHỐNG MÉO ẢNH */}
          <div
            className={`absolute inset-[-15%] size-[130%] ${unSkewClass} ${transformOrigin}`}
          >
            <ImageCustom
              src={movie.thumb_url}
              alt={movie.name}
              widths={[450, 350, 250, 150]}
              sizes="(max-width: 640px) 46vw, (max-width: 768px) 31vw, (max-width: 1024px) 23vw, 20vw"
              loading={rank < 3 ? "eager" : "lazy"}
              fetchPriority={rank < 3 ? "high" : "auto"}
              className="absolute inset-0 object-cover size-full hover:scale-105 transition duration-500 ease-in-out"
            />
          </div>
        </div>

        {/* Lớp Overlay đen mờ ở đáy - Đặt ở Outer nên nó LUÔN THẲNG NGANG */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />

        {badgeText && (
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-20 bg-[#5c6b7d]/95 text-white text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-t-md backdrop-blur-sm shadow-sm whitespace-nowrap">
            {badgeText}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mt-3 px-1 z-10 relative">
        {rank && (
          <span className="text-[3.5rem] leading-[0.75] font-black italic tracking-tighter bg-custom-gradient bg-clip-text text-transparent drop-shadow-md select-none shrink-0 pr-3 overflow-visible inline-block">
            {rank}
          </span>
        )}
        <div className="flex flex-col min-w-0 flex-1 space-y-0.5">
          <h3 className="text-white text-sm sm:text-base font-bold line-clamp-1 group-hover:text-primary transition-colors leading-tight">
            {movie.name}
          </h3>

          {movie.origin_name && (
            <p className="text-zinc-400 text-[11px] sm:text-xs line-clamp-1 uppercase font-medium">
              {movie.origin_name}
            </p>
          )}

          {metaInfo && (
            <p className="text-zinc-400 text-[11px] sm:text-xs line-clamp-1 font-medium whitespace-nowrap overflow-hidden text-ellipsis">
              {metaInfo}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
