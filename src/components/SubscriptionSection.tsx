"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import MovieCard from "@/components/MovieCard";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/Carousel";
import { useData } from "@/providers/BaseDataContextProvider";
import { formatEpisodeName, getLocalSubscriptions } from "@/lib/utils";
import { SubscriptionItem } from "@/types";

export default function SubscriptionSection() {
  const { user } = useData();

  // Lấy danh sách phim theo dõi (từ Redis/DB hoặc LocalStorage)
  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ["subscriptions-list", user?.id || "guest"],
    queryFn: async () => {
      if (!user) return getLocalSubscriptions(); // Guest lấy từ LocalStorage
      const res = await fetch("/api/subscriptions");
      if (!res.ok) return [];
      return res.json() as Promise<SubscriptionItem[]>;
    },
    refetchOnWindowFocus: true, // Tự cập nhật khi user quay lại tab
  });

  if (isLoading)
    return <div className="h-40 animate-pulse bg-zinc-900 rounded-xl" />;
  if (subscriptions.length === 0) return null; // Không hiện nếu rỗng

  return (
    <div>
      <div className="relative z-20 flex items-center justify-between font-bold">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 rounded-full bg-primary shadow-[0_0_10px_rgba(225,29,72,0.5)]"></div>
          <h2 className="text-xl sm:text-2xl">Phim bạn đang theo dõi</h2>
        </div>

        <Link href="/ca-nhan/theo-doi" className="relative group">
          Xem thêm
          <span className="absolute -bottom-1 right-0 w-0 border-b-4 border-primary transition-all duration-300 group-hover:w-full" />
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
