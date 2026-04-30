"use client";

import Link from "next/link";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/Carousel";
import MovieCard from "@/components/shared/MovieCard";
import { Movie } from "@/types";

interface MovieSectionProps {
  title: string;
  movies: Movie[];
  hrefViewMore?: string;
}

const MovieSection = ({ title, movies, hrefViewMore }: MovieSectionProps) => {
  return (
    <div className="animate-in fade-in duration-700">
      <div className="flex items-center justify-between font-bold mb-4">
        <h2 className="text-xl sm:text-2xl">{title}</h2>
        {hrefViewMore && (
          <Link
            href={hrefViewMore}
            className="relative group text-sm sm:text-base"
          >
            Xem thêm
            <span className="absolute -bottom-1 right-0 w-0 border-b-4 border-primary transition-all duration-300 group-hover:w-full" />
          </Link>
        )}
      </div>

      <Carousel opts={{ align: "start", slidesToScroll: "auto" }}>
        <CarouselContent className="-ml-4">
          {movies.map((movie) => (
            <CarouselItem
              key={movie._id}
              className="pl-4 !basis-[46%] sm:!basis-1/3 md:!basis-1/4 lg:!basis-1/6 py-4"
            >
              <MovieCard
                movie_slug={movie.slug}
                name={movie.name}
                thumb_url={movie.thumb_url}
                episode_current={movie.episode_current}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  );
};

export default MovieSection;
