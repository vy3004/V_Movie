"use client";

import Link from "next/link";
import Image from "next/image";
import Autoplay from "embla-carousel-autoplay";
import { PlayIcon, PlusIcon, StarIcon } from "@heroicons/react/24/solid";

import {
  Carousel,
  CarouselContent,
  CarouselDots,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/Carousel";

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
          <CarouselItem key={movie._id} className="relative">
            <Image
              src={`${apiConfig.IMG_URL}${movie.poster_url}`}
              alt={movie.origin_name}
              width={2000}
              height={1125}
              priority={i === 0}
              placeholder="blur"
              blurDataURL="/blur_img.jpg"
              className="w-full h-full object-cover"
            />
            {/* Overlay gradients */}
            <div className="absolute inset-0 bg-hero-top" />
            <div className="absolute inset-0 bg-hero-left" />
            <div className="absolute inset-0 bg-hero-bottom" />

            {/* Movie details */}
            <div className="absolute top-1/4 left-24 max-w-[50%] select-none">
              <h2 className="text-5xl font-extrabold text-primary line-clamp-1 pb-1">
                {movie.name}
              </h2>
              <h3 className="text-3xl line-clamp-1">{movie.origin_name}</h3>

              <div className="space-y-4 text-sm pt-8">
                <div className="space-x-2">
                  <Badge className="uppercase">{movie.tmdb.type}</Badge>
                  <Badge>{movie.quality}</Badge>
                  <Badge>
                    {movie.lang} {movie.sub_docquyen && "độc quyền"}
                  </Badge>
                </div>

                <MovieDetails movie={movie} />

                <CategoryAndCountry movie={movie} />
              </div>

              <ActionButtons slug={movie.slug} />
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="left-7 top-1/3" />
      <CarouselNext className="right-7 top-1/3" />
      <CarouselDots className="right-20 bottom-[40%]" />
    </Carousel>
  );
};

export default HeroCarousel;

const Badge = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <span className={`px-2 py-1 rounded bg-primary ${className}`}>
    {children}
  </span>
);

const BorderedItem = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <span className={`border-r-2 pr-2 last:border-0 ${className}`}>
    {children}
  </span>
);

const MovieDetails = ({ movie }: { movie: Movie }) => (
  <div className="space-x-2 flex items-center text-sm">
    <BorderedItem className="text-primary font-semibold flex items-center">
      <StarIcon className="mr-1 size-4" /> {movie.tmdb.vote_average.toFixed(0)}
    </BorderedItem>

    <span className="border-r-2 pr-2">{movie.year}</span>
    {movie.chieurap && <BorderedItem>Chiếu rạp</BorderedItem>}
    {movie.tmdb.season && <BorderedItem>Phần {movie.tmdb.season}</BorderedItem>}
    <BorderedItem>{movie.time}</BorderedItem>
    <BorderedItem>{movie.episode_current}</BorderedItem>
  </div>
);

const CategoryAndCountry = ({ movie }: { movie: Movie }) => (
  <div className="space-x-2">
    {movie.country.map((ctr) => (
      <Badge className="bg-white/40" key={ctr.id}>
        {ctr.name}
      </Badge>
    ))}
    {movie.category.map((cate) => (
      <Badge className="bg-white/40" key={cate.id}>
        {cate.name}
      </Badge>
    ))}
  </div>
);

const ActionButtons = ({ slug }: { slug: string }) => (
  <div className="flex items-center gap-2 pt-12">
    <Link
      href={`/phim/${slug}`}
      className="flex items-center font-bold bg-primary rounded px-4 py-3"
    >
      <PlayIcon className="size-8" />
      Xem Phim
    </Link>
    <button className="bg-white/80 rounded p-3">
      <PlusIcon className="size-8 text-background" />
    </button>
  </div>
);
