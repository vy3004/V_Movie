"use client";

import React from "react";
import Link from "next/link";
import MovieCard from "@/components/MovieCard";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/Carousel";
import { formatEpisodeName } from "@/lib/utils";
import { useSubscriptionList } from "@/hooks/useSubscription";

export default function SubscriptionSection() {
  const { subscriptions, isLoading } = useSubscriptionList({
    limit: 12,
    filter: "all",
  });

  if (isLoading) {
    return <div className="h-40 animate-pulse bg-zinc-900 rounded-xl" />;
  }

  if (subscriptions.length === 0) return null;

  return (
    <div>
      <div className="relative z-20 flex items-center justify-between font-bold mb-4">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]"></div>
          <h2 className="text-xl sm:text-2xl text-white">
            Phim bạn đang theo dõi
          </h2>
        </div>

        <Link
          href="/dashboard/subscriptions"
          className="relative group text-sm text-zinc-400 hover:text-white transition-colors"
        >
          Xem tất cả
          <span className="absolute -bottom-1 right-0 w-0 border-b-2 border-rose-500 transition-all duration-300 group-hover:w-full" />
        </Link>
      </div>

      <Carousel
        opts={{
          align: "start",
          slidesToScroll: "auto",
        }}
      >
        <CarouselContent>
          {subscriptions.map((sub) => (
            <CarouselItem
              key={sub.movie_slug}
              className="!basis-[46%] sm:!basis-1/3 md:!basis-1/4 lg:!basis-1/6 py-4"
            >
              <MovieCard
                movie_slug={sub.movie_slug}
                name={sub.movie_name}
                thumb_url={sub.movie_poster}
                episode_current={formatEpisodeName(
                  sub.last_known_episode_slug,
                  sub.has_new_episode,
                )}
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
