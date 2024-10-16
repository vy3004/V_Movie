import Link from "next/link";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/Carousel";
import MovieCard from "@/components/MovieCard";

import { Movie } from "@/lib/types";

interface MovieSectionProps {
  title: string;
  movies: Movie[];
  hrefViewMore?: string;
}

const MovieSection = ({ title, movies, hrefViewMore }: MovieSectionProps) => {
  return (
    <div className="space-y-4">
      <div className="relative z-20 flex items-center justify-between font-bold">
        <h1 className="text-2xl">{title}</h1>

        {hrefViewMore && (
          <Link href={hrefViewMore} className="relative group">
            Xem thêm
            <h2 className="absolute -bottom-1 right-0 w-0 border-b-4 border-primary transition-all duration-300 group-hover:w-full" />
          </Link>
        )}
      </div>
      <Carousel
        opts={{
          align: "start",
          slidesToScroll: 6,
        }}
      >
        <CarouselContent>
          {movies.map((movie) => (
            <CarouselItem key={movie._id} className="!basis-1/6">
              <MovieCard movie={movie} />
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
