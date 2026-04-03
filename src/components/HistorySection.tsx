"use client";

import React, { useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/Carousel";
import HistoryCard from "@/components/HistoryCard";
import { getLocalHistory } from "@/lib/utils";
import { useData } from "@/providers/BaseDataContextProvider";

interface HistorySectionProps {
  title: string;
  type: "watching" | "finished";
}

export default function HistorySection({ title, type }: HistorySectionProps) {
  const queryClient = useQueryClient();
  const { user, authLoading } = useData();

  const { data: historyList = [], isLoading } = useQuery({
    queryKey: ["movie-history", user?.id],
    queryFn: async () => {
      if (user) {
        const res = await fetch("/api/history/list");
        return res.json();
      }
      return getLocalHistory();
    },
    enabled: !authLoading,
  });

  const filteredList = useMemo(() => {
    return (
      (historyList || [])
        .filter((item: any) => {
          // 1. Xác định trạng thái đã xong
          const isFinished =
            item.is_finished === true || item.isFinished === true;

          // 2. Lấy lastTime của tập đang xem gần nhất để lọc 1 phút
          const currentEp = item.last_episode_slug || item.episodeSlug;
          const progress = item.episodes_progress?.[currentEp];
          const lastTime = progress?.lastTime || item.lastTime || 0;

          // BỎ QUA PHIM DƯỚI 60 GIÂY (Tránh rác mục xem tiếp)
          // Lưu ý: Phim đã xem xong thì vẫn cho hiện dù ngắn
          if (!isFinished && lastTime < 60) return false;

          // 3. Phân loại
          return type === "finished" ? isFinished : !isFinished;
        })
        // SẮP XẾP LẠI LẦN CUỐI THEO THỜI GIAN MỚI NHẤT
        .sort(
          (a: any, b: any) =>
            new Date(b.updated_at || 0).getTime() -
            new Date(a.updated_at || 0).getTime(),
        )
    );
  }, [historyList, type]);

  useEffect(() => {
    const handleRefresh = () =>
      queryClient.invalidateQueries({ queryKey: ["movie-history", user?.id] });
    window.addEventListener("history-synced", handleRefresh);
    window.addEventListener("local-history-updated", handleRefresh);
    return () => {
      window.removeEventListener("history-synced", handleRefresh);
      window.removeEventListener("local-history-updated", handleRefresh);
    };
  }, [queryClient, user?.id]);

  if (authLoading || isLoading || filteredList.length === 0) return null;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-1000 mb-10">
      <div className="flex items-center gap-3 font-bold mb-4">
        <div
          className={`w-1.5 h-6 rounded-full ${type === "finished" ? "bg-green-500 shadow-[0_0_10px_#22c55e]" : "bg-primary shadow-[0_0_10px_#e11d48]"}`}
        />
        <h2 className="text-xl sm:text-2xl text-white tracking-tight">
          {title}
        </h2>
      </div>

      <Carousel opts={{ align: "start", slidesToScroll: "auto" }}>
        <CarouselContent className="-ml-4">
          {filteredList.map((item: any) => (
            <CarouselItem
              key={item.movie_slug || item.movieSlug}
              className="pl-4 !basis-[70%] sm:!basis-1/2 md:!basis-1/3 lg:!basis-1/4 py-2"
            >
              <HistoryCard item={item} type={type} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <div className="hidden md:block">
          <CarouselPrevious className="-left-4 bg-zinc-900/90 border-none hover:bg-primary transition-all" />
          <CarouselNext className="-right-4 bg-zinc-900/90 border-none hover:bg-primary transition-all" />
        </div>
      </Carousel>
    </div>
  );
}
