"use client";

import Autoplay from "embla-carousel-autoplay";

import {
  Carousel,
  CarouselContent,
  CarouselDots,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/Carousel";
import { ActionButtons, MovieInfo } from "@/components/MovieDetail";
import ImageCustom from "@/components/ImageCustom";

import { Movie } from "@/lib/types";

const HeroCarousel = ({ movies }: { movies: Movie[] }) => {
  return (
    <Carousel
      opts={{
        align: "center",
        loop: true,
        slidesToScroll: 1,
      }}
      plugins={[
        Autoplay({
          delay: 7000,
        }),
      ]}
    >
      <CarouselContent>
        {movies.map((movie, i) => (
          <CarouselItem
            key={movie._id}
            className="relative aspect-video mb-10 sm:mb-0"
          >
            <ImageCustom
              alt={movie.origin_name}
              src={`${movie.poster_url}`}
              widths={[1280, 1024, 768, 640, 432]}
              sizes="100vw"
              loading={i === 0 ? "eager" : "lazy"}
              className="absolute inset-0 size-full object-cover"
            />
            {/* Overlay gradients */}
            <div className="absolute inset-0 bg-hero-top" />
            <div className="absolute inset-0 bg-hero-left" />
            <div className="absolute inset-0 bg-hero-bottom" />

            {/* Movie details */}
            <div className="absolute top-[10%] sm:top-1/4 left-10 sm:left-24 w-[85%] lg:!w-1/2 select-none space-y-4 md:space-y-12">
              <MovieInfo movie={movie} isDetail={false} />
              <ActionButtons movie={movie} />
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="left-7 top-1/3 hidden sm:block" />
      <CarouselNext className="right-7 top-1/3 hidden sm:block" />
      <CarouselDots className="right-5 sm:right-20 bottom-[10%] md:bottom-[20%] xl:bottom-[40%]" />
    </Carousel>
  );
};

export default HeroCarousel;
