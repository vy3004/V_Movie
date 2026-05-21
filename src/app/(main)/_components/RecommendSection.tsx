"use client";

import { SparklesIcon } from "@heroicons/react/24/solid";
import MovieCard from "@/components/shared/MovieCard";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/Carousel";
import { useRecommendations } from "@/hooks/useRecommendations";

export default function RecommendSection() {
  const { movies } = useRecommendations();

  if (movies?.length === 0) return null;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 mb-10">
      <div className="relative z-20 flex items-center justify-between font-bold mb-4">
        <div className="flex items-center gap-2">
          <SparklesIcon className="w-6 h-6 text-primary" />
          <h2 className="text-xl sm:text-2xl text-white tracking-tight">
            Có thể bạn sẽ thích
          </h2>
        </div>
      </div>

      <Carousel opts={{ align: "start", slidesToScroll: "auto" }}>
        <CarouselContent>
          {movies.map((movie) => (
            <CarouselItem
              key={movie.movie_slug}
              className="!basis-[46%] sm:!basis-1/3 md:!basis-1/4 lg:!basis-1/6 py-4"
            >
              <MovieCard
                movie_slug={movie.movie_slug}
                name={movie.name}
                thumb_url={movie.thumb_url}
                episode_current={movie.episode_current || "Tập mới"}
                reason={movie.reason}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  );
}
