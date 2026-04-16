"use client";

import React, { useMemo, useEffect } from "react";
import Link from "next/link";
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
import { HistoryItem, EpisodeProgress } from "@/types";

interface HistorySectionProps {
  title: string;
  type: "watching" | "finished";
}

export default function HistorySection({ title, type }: HistorySectionProps) {
  const queryClient = useQueryClient();
  const { user, authLoading } = useData();

  const { data: historyList = [], isLoading } = useQuery<HistoryItem[]>({
    queryKey: ["movie-history", user?.id],
    queryFn: async () => {
      if (user) {
        const res = await fetch(`/api/history/list?userId=${user.id}`);
        if (!res.ok) throw new Error("Network error");
        const data = await res.json();
        return data as HistoryItem[];
      }
      return getLocalHistory();
    },
    enabled: !authLoading,
    staleTime: 1000 * 30, // Cache 30 giây
    refetchOnMount: true, // Luôn refetch khi component mount (user navigate về trang chủ)
  });

  const filteredList = useMemo(() => {
    if (!historyList.length) return [];

    return historyList
      .filter((item: HistoryItem) => {
        const isFinished = item.is_finished === true;

        // 1. Lấy tiến trình tập hiện tại
        const currentEp = item.last_episode_slug || "";
        let progress: EpisodeProgress | undefined =
          item.episodes_progress?.[currentEp];

        // TỐI ƯU SENIOR: Nếu tập hiện tại chưa có progress (do là tập kế tiếp chưa xem)
        // Ta tìm tập có thời gian cập nhật mới nhất để lấy lastTime thực tế của User
        if (
          !progress &&
          item.episodes_progress &&
          Object.keys(item.episodes_progress).length > 0
        ) {
          const sortedProgress = Object.values(item.episodes_progress).sort(
            (a, b) =>
              new Date(b.ep_updated_at).getTime() -
              new Date(a.ep_updated_at).getTime(),
          );
          progress = sortedProgress[0];
        }

        const lastTime = progress?.ep_last_time || 0;

        // 2. LOGIC LỌC THÔNG MINH
        if (type === "watching") {
          if (isFinished) return false;

          // Chỉ ẩn nếu phim hoàn toàn mới (0s) và không có lịch sử các tập khác
          const hasAnyHistory =
            Object.keys(item.episodes_progress || {}).length > 0;
          if (lastTime < 60 && !hasAnyHistory) return false;

          return true;
        }

        // Nếu là mục "Đã xong"
        return isFinished;
      })
      .sort((a, b) => {
        // Sắp xếp theo updated_at của toàn bộ movie
        return (
          new Date(b.updated_at || 0).getTime() -
          new Date(a.updated_at || 0).getTime()
        );
      });
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

  // Tránh Layout Shift: Trả về null nếu đang load hoặc không có data
  if (authLoading || isLoading || filteredList.length === 0) return null;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 mb-10">
      <div className="relative z-20 flex items-center justify-between font-bold">
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

        <Link href="/ca-nhan/theo-doi" className="relative group">
          Xem thêm
          <span className="absolute -bottom-1 right-0 w-0 border-b-4 border-primary transition-all duration-300 group-hover:w-full" />
        </Link>
      </div>

      <Carousel opts={{ align: "start", slidesToScroll: "auto" }}>
        <CarouselContent className="-ml-4">
          {filteredList.map((item) => (
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
