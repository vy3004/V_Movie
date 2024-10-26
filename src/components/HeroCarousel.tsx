"use client";

import Image from "next/image";
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

import { Movie } from "@/lib/types";
import { apiConfig } from "@/lib/configs";

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
      className="max-h-[850px]"
    >
      <CarouselContent>
        {movies.map((movie, i) => (
          <CarouselItem key={movie._id} className="relative mb-10 sm:mb-0">
            <Image
              src={`${apiConfig.IMG_URL}${movie.poster_url}`}
              alt={movie.origin_name}
              width={2000}
              height={1125}
              priority={i === 0}
              placeholder="blur"
              blurDataURL="/blur_img.jpg"
              className="size-full object-cover"
            />
            {/* Overlay gradients */}
            <div className="absolute inset-0 bg-hero-top" />
            <div className="absolute inset-0 bg-hero-left" />
            <div className="absolute inset-0 bg-hero-bottom" />

            {/* Movie details */}
            <div className="absolute top-1/4 left-10 sm:left-24 w-[85%] lg:!w-1/2 select-none">
              <MovieInfo movie={movie} isDetail={false} />
              <ActionButtons movie={movie} className="mt-4 md:mt-12" />
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
