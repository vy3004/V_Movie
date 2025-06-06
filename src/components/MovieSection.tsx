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
    <div>
      <div className="relative z-20 flex items-center justify-between font-bold">
        <h2 className="text-xl sm:text-2xl">{title}</h2>

        {hrefViewMore && (
          <Link href={hrefViewMore} className="relative group">
            Xem thêm
            <span className="absolute -bottom-1 right-0 w-0 border-b-4 border-primary transition-all duration-300 group-hover:w-full" />
          </Link>
        )}
      </div>
      <Carousel
        opts={{
          align: "start",
          slidesToScroll: "auto",
        }}
      >
        <CarouselContent>
          {movies.map((movie) => (
            <CarouselItem
              key={movie._id}
              className="!basis-[46%] sm:!basis-1/3 md:!basis-1/4 lg:!basis-1/6 py-4"
            >
              <MovieCard movie={movie} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="hidden sm:block" />
        <CarouselNext className="hidden sm:block" />
      </Carousel>
    </div>
  );
};

export default MovieSection;
