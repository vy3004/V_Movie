"use client";

import React from "react";
import { useInView } from "react-intersection-observer";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { PageMoviesData } from "@/types";

const MovieSection = dynamic(() => import("@/components/MovieSection"), {
  ssr: false,
});

interface Props {
  title: string;
  slug: string;
}

const LazyMovieSection = ({ title, slug }: Props) => {
  // 1. Dùng Intersection Observer để phát hiện khi user cuộn tới
  const { ref, inView } = useInView({
    triggerOnce: true, // Chỉ kích hoạt 1 lần duy nhất
    rootMargin: "200px 0px", // Load sớm trước khi user cuộn tới 200px
  });

  // 2. Fetch data bằng React Query
  const { data, isLoading, isError } = useQuery<PageMoviesData>({
    queryKey: ["movies-list", slug],
    queryFn: async () => {
      const res = await fetch(`/api/movies/list?slug=${slug}&limit=24`);
      if (!res.ok) throw new Error("Failed to fetch movies");
      return res.json();
    },
    enabled: inView, //Chỉ chạy query khi section đã vào tầm mắt (hoặc sắp vào)
    staleTime: 1000 * 60 * 60 * 12, // Dữ liệu danh sách phim giữ 12h
  });

  return (
    <div ref={ref} className="min-h-[200px]">
      {isLoading && (
        <div className="h-56 mb-4 animate-pulse bg-zinc-900 rounded-xl" />
      )}

      {data && data.items.length > 0 && (
        <div className="animate-in fade-in duration-700">
          <MovieSection title={title} movies={data.items} hrefViewMore={slug} />
        </div>
      )}

      {isError && (
        <div className="text-center text-zinc-500 py-10 text-sm">
          Không thể tải dữ liệu cho mục {title}
        </div>
      )}
    </div>
  );
};

export default LazyMovieSection;
