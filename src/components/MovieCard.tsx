"use client";

import Link from "next/link";
import { StarIcon } from "@heroicons/react/24/solid";

import ImageCustom from "@/components/ImageCustom";

import { Movie } from "@/lib/types";

interface MovieCardProps {
  movie: Movie;
}

export default function MovieCard({ movie }: MovieCardProps) {
  return (
    <Link href={`/phim/${movie.slug}`} className="space-y-2 relative group">
      <div className="relative aspect-[3/4] h-5/6 w-full rounded-lg overflow-hidden">
        <ImageCustom
          src={movie.thumb_url}
          alt={movie.origin_name}
          widths={[320]}
          loading="lazy"
          className="absolute inset-0 object-cover size-full hover:scale-110 transition duration-500 ease-in-out"
        />
      </div>
      {movie.tmdb && (
        <div className="absolute right-2 top-0 bg-black/80 rounded-lg px-2 py-1 flex items-center gap-1 text-xs text-primary font-semibold">
          <StarIcon className="size-3" />
          {movie.tmdb.vote_average.toFixed(0)}
        </div>
      )}
      <div className="line-clamp-2 group-hover:text-primary group-hover:font-semibold">
        {movie.name}
      </div>
    </Link>
  );
}
