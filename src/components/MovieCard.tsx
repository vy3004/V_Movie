"use client";

import Link from "next/link";

import ImageCustom from "@/components/ImageCustom";

interface MovieCardProps {
  movie_slug: string;
  name: string;
  thumb_url: string;
  episode_current: string;
}

export default function MovieCard({
  movie_slug,
  name,
  thumb_url,
  episode_current,
}: MovieCardProps) {
  return (
    <Link href={`/phim/${movie_slug}`} className="space-y-2 relative group">
      <div className="relative aspect-[3/4] h-5/6 w-full rounded-lg overflow-hidden">
        <ImageCustom
          src={thumb_url}
          alt={name}
          widths={[320, 256, 200, 160]}
          sizes="(max-width: 640px) 46vw, (max-width: 768px) 33.33vw, (max-width: 1024px) 25vw, 16.67vw"
          loading="lazy"
          className="absolute inset-0 object-cover size-full hover:scale-110 transition duration-500 ease-in-out"
        />
      </div>
      <div className="absolute right-2 top-0 bg-black/80 rounded-lg px-2 py-1 flex items-center gap-1 text-xs text-primary capitalize group-hover:text-main font-semibold">
        {episode_current}
      </div>
      <div className="line-clamp-2 group-hover:text-main group-hover:font-semibold">
        {name}
      </div>
    </Link>
  );
}
