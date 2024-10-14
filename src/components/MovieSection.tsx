"use client";

import Link from "next/link";
import Image from "next/image";
import { StarIcon } from "@heroicons/react/24/solid";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/Carousel";

import { Movie } from "@/lib/types";
import { apiConfig } from "@/lib/configs";

interface MovieSectionProps {
  title: string;
  movies: Movie[];
  hrefViewMore?: string;
}

const MovieSection = ({ title, movies, hrefViewMore }: MovieSectionProps) => {
  return (
    <div className="space-y-4">
      <div className="relative z-20 flex items-center justify-between font-bold">
        <div className="text-2xl">{title}</div>

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
          slidesToScroll: 6,
        }}
      >
        <CarouselContent>
          {movies.map((movie) => (
            <CarouselItem key={movie._id} className="!basis-1/6">
              <Link
                href={`phim/${movie.slug}`}
                className="space-y-2 relative group"
              >
                <div className="h-5/6 rounded-lg overflow-hidden">
                  <Image
                    src={`${apiConfig.IMG_URL}${movie.thumb_url}`}
                    alt={movie.origin_name}
                    width={500}
                    height={750}
                    placeholder="blur"
                    blurDataURL="/blur_img.jpg"
                    className="object-cover h-full hover:scale-110 transition duration-500 ease-in-out"
                  />
                </div>
                <div className="absolute right-2 top-0 bg-black/80 rounded-lg px-2 py-1 flex items-center gap-1 text-xs text-primary font-semibold">
                  <StarIcon className="size-3" />
                  {movie.tmdb.vote_average.toFixed(0)}
                </div>
                <div className="line-clamp-2 group-hover:text-primary group-hover:font-semibold">
                  {movie.name}
                </div>
              </Link>
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
