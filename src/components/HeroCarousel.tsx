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
import {
  ActionButtons,
  CategoryAndCountry,
  MovieTags,
} from "@/components/MovieDetail";
import ImageCustom from "@/components/ImageCustom";

import { Movie } from "@/types";
import { formatMovieTitle } from "@/lib/utils";

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
        {movies.map((movie, i) => {
          const [title, subtitle] = formatMovieTitle(
            movie.name,
            movie.origin_name,
          );

          return (
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
                fetchPriority={i === 0 ? "high" : undefined}
                quality={85}
                className="absolute inset-0 size-full object-cover"
              />
              {/* Overlay gradients */}
              <div className="absolute inset-0 bg-hero-top" />
              <div className="absolute inset-0 bg-hero-left" />
              <div className="absolute inset-0 bg-hero-bottom -bottom-[4px]" />

              {/* Movie details */}
              <div className="absolute top-[10%] sm:top-[16%] left-10 sm:left-24 w-3/4 lg:!w-1/2 select-none space-y-4 md:space-y-10">
                <div className="font-black tracking-tighter uppercase italic leading-[0.85]">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl">
                    {title}
                  </h1>
                  <h3
                    className="text-xl sm:text-2xl md:text-3xl lg:text-4xl text-transparent stroke-text"
                    style={{ WebkitTextStroke: "1px rgba(255,255,255,0.6)" }}
                  >
                    {subtitle}
                  </h3>
                </div>
                <div className="space-y-2">
                  <MovieTags className="space-y-2" movie={movie} />
                  <CategoryAndCountry
                    className="hidden md:flex"
                    movie={movie}
                  />
                </div>

                <ActionButtons movie={movie} />
              </div>
            </CarouselItem>
          );
        })}
      </CarouselContent>
      <CarouselPrevious className="left-7 top-1/3" />
      <CarouselNext className="right-7 top-1/3" />
      <CarouselDots className="right-5 sm:right-20 bottom-[20%] xl:bottom-[40%]" />
    </Carousel>
  );
};

export default HeroCarousel;
