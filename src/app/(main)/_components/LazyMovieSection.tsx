"use client";

import { useInView } from "react-intersection-observer";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { PageMoviesData } from "@/types";

const MovieSection = dynamic(() => import("@/components/shared/MovieSection"), {
  ssr: false,
});

interface Props {
  title: string;
  slug: string;
}

const LazyMovieSection = ({ title, slug }: Props) => {
  const { ref, inView } = useInView({
    triggerOnce: true,
    rootMargin: "200px 0px",
  });

  const { data, isLoading, isError } = useQuery<PageMoviesData>({
    queryKey: ["movies-list", slug],
    queryFn: async () => {
      const res = await fetch(
        `/api/movies/list?slug=${encodeURIComponent(slug)}&limit=24`,
      );
      if (!res.ok) throw new Error("Failed to fetch movies");
      return res.json();
    },
    enabled: inView,
    staleTime: 1000 * 60 * 60 * 12,
  });

  if (!inView || isLoading) {
    return (
      <div ref={ref} className="min-h-[200px]">
        <div className="h-56 mb-4 animate-pulse bg-zinc-900 rounded-xl" />
      </div>
    );
  }

  if (isError || !data?.items || data.items.length === 0) return null;

  return (
    <div className="animate-in fade-in duration-700">
      <MovieSection title={title} movies={data.items} hrefViewMore={slug} />
    </div>
  );
};

export default LazyMovieSection;
