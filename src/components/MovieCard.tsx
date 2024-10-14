"use client"; // Client-side for hooks

import Image from "next/image";

interface MovieCardProps {
  movie: {
    id: number;
    title: string;
    poster: string;
  };
}

export default function MovieCard({ movie }: MovieCardProps) {
  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <Image
        src={movie.poster}
        alt={movie.title}
        width={500}
        height={750}
        loading="lazy" // Lazy load for performance
      />
      <h2 className="text-xl text-white mt-2">{movie.title}</h2>
    </div>
  );
}
