"use client";

import React from "react";
import Link from "next/link";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/Carousel";
import HistoryCard from "@/components/HistoryCard";
import { useHistoryList } from "@/hooks/useHistory";

interface HistorySectionProps {
  title: string;
  type: "watching" | "finished";
}

export default function HistorySection({ title, type }: HistorySectionProps) {
  const { historyList, isLoading, authLoading } = useHistoryList({
    limit: 16,
    filter: type,
  });

  if (authLoading || isLoading || !historyList?.length) return null;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 mb-10">
      <div className="relative z-20 flex items-center justify-between font-bold mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-1.5 h-6 rounded-full ${
              type === "finished"
                ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                : "bg-primary shadow-[0_0_10px_rgba(225,29,72,0.5)]"
            }`}
          />
          <h2 className="text-xl sm:text-2xl text-white tracking-tight">
            {title}
          </h2>
        </div>

        <Link href="/dashboard/history" className="relative group">
          <span className="text-zinc-400 group-hover:text-white transition-colors">
            Xem thêm
          </span>
          <span className="absolute -bottom-1 right-0 w-0 border-b-4 border-primary transition-all duration-300 group-hover:w-full" />
        </Link>
      </div>

      <Carousel opts={{ align: "start", slidesToScroll: "auto" }}>
        <CarouselContent className="-ml-4">
          {historyList.map((item) => (
            <CarouselItem
              key={item.movie_slug}
              className="pl-4 !basis-[70%] sm:!basis-1/2 md:!basis-1/3 lg:!basis-1/4 py-2"
            >
              <HistoryCard item={item} type={type} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="top-[40%]" />
        <CarouselNext className="top-[40%]" />
      </Carousel>
    </div>
  );
}
