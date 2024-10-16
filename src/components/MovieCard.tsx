"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { StarIcon } from "@heroicons/react/24/solid";

import { apiConfig } from "@/lib/configs";
import { Movie } from "@/lib/types";

interface MovieCardProps {
  movie: Movie;
}

export default function MovieCard({ movie }: MovieCardProps) {
  const [imgSrc, setImgSrc] = useState(
    `${apiConfig.IMG_URL}${movie.thumb_url}`
  );

  return (
    <Link href={`phim/${movie.slug}`} className="space-y-2 relative group">
      <div className="h-5/6 rounded-lg overflow-hidden">
        <Image
          src={imgSrc}
          onError={() => setImgSrc("/error_img.png")}
          alt={movie.origin_name}
          width={500}
          height={750}
          placeholder="blur"
          blurDataURL="/blur_img.jpg"
          className="object-cover h-full hover:scale-110 transition duration-500 ease-in-out"
        />
      </div>
      <div className="absolute right-2 top-0 bg-black/80 rounded-lg px-2 py-1 flex items-center gap-1 text-xs text-primary font-semibold">
        <StarIcon className="size-3" />
        {movie.tmdb.vote_average.toFixed(0)}
      </div>
      <div className="line-clamp-2 group-hover:text-primary group-hover:font-semibold">
        {movie.name}
      </div>
    </Link>
  );
}
