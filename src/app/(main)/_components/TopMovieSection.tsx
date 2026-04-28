import Link from "next/link";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/Carousel";
import TopMovieCard from "@/app/(main)/_components/TopMovieCard";
import { Movie } from "@/types";

interface MovieSectionProps {
  title?: string;
  movies: Movie[];
  hrefViewMore?: string;
}

const TopMovieSection = ({
  title,
  movies,
  hrefViewMore,
}: MovieSectionProps) => {
  return (
    <div>
      <div className="relative z-20 flex items-center justify-between font-bold">
        {title && <h2 className="text-xl sm:text-2xl">{title}</h2>}
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
          {movies.map((movie, index) => (
            <CarouselItem
              key={movie._id}
              className="!basis-2/5 sm:!basis-1/3 md:!basis-1/4 lg:!basis-1/5 py-4"
            >
              <TopMovieCard movie={movie} rank={index + 1} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  );
};

export default TopMovieSection;
