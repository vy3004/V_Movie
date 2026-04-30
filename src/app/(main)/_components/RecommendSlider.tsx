"use client";

import React, { useEffect, useState } from "react";
import MovieCard from "@/components/shared/MovieCard";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/Carousel";
import { HistoryItem, MovieRecommendation } from "@/types";
import { generateSlug } from "@/lib/utils";
import { SparklesIcon } from "@heroicons/react/24/solid";

interface RecommendSliderProps {
  initialMovies: MovieRecommendation[];
  isGuest: boolean;
}

export default function RecommendSlider({
  initialMovies,
  isGuest,
}: RecommendSliderProps) {
  const [movies, setMovies] = useState<MovieRecommendation[]>(initialMovies);
  const [loading, setLoading] = useState(isGuest);

  useEffect(() => {
    // Nếu User đã có data AI -> Xong nhiệm vụ
    if (!isGuest && initialMovies.length > 0) {
      setLoading(false);
      return;
    }

    // Nếu là Guest -> Tự quét LocalStorage và gọi API
    if (isGuest) {
      const fetchGuestRecommendations = async () => {
        try {
          const localHistoryStr = localStorage.getItem("v_movie_guest_history");

          if (!localHistoryStr) {
            setLoading(false);
            return;
          }

          let historyArr: HistoryItem[] = [];
          try {
            const parsed = JSON.parse(localHistoryStr);
            historyArr = (
              Array.isArray(parsed) ? parsed : Object.values(parsed)
            ) as HistoryItem[];
          } catch {
            setLoading(false);
            return;
          }

          const genreCounts: Record<string, number> = {};
          const recently_finished: string[] = [];
          const currently_watching: string[] = [];

          historyArr.forEach((movie) => {
            const isMeaningfulView =
              movie.is_finished ||
              (movie.episodes_progress &&
                Object.values(movie.episodes_progress).some((ep) => {
                  return (
                    ep.ep_is_finished ||
                    ep.ep_last_time > 300 ||
                    (ep.ep_duration > 0 &&
                      ep.ep_last_time > ep.ep_duration * 0.1)
                  );
                }));

            if (!isMeaningfulView) {
              return;
            }

            if (
              movie.movie_metadata?.genres &&
              Array.isArray(movie.movie_metadata.genres)
            ) {
              movie.movie_metadata.genres.forEach((rawGenre) => {
                if (rawGenre) {
                  const slug = generateSlug(rawGenre);
                  if (slug) genreCounts[slug] = (genreCounts[slug] || 0) + 1;
                }
              });
            }

            if (movie.movie_name) {
              if (movie.is_finished && recently_finished.length < 5)
                recently_finished.push(movie.movie_name);
              else if (!movie.is_finished && currently_watching.length < 5)
                currently_watching.push(movie.movie_name);
            }
          });

          if (Object.keys(genreCounts).length === 0) {
            setLoading(false);
            return;
          }

          const res = await fetch("/api/recommend/guest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              genre_counts: genreCounts,
              recently_finished,
              currently_watching,
            }),
          });

          const data = await res.json();

          if (!res.ok) {
            console.error("API recommend/guest failed:", res.status);
            return;
          }

          if (data.success && data.movies) {
            setMovies(data.movies);
          }
        } catch (error) {
          console.error("Lỗi lấy gợi ý cho Guest:", error);
        } finally {
          setLoading(false);
        }
      };

      fetchGuestRecommendations();
    } else {
      setLoading(false);
    }
  }, [isGuest, initialMovies]);

  if (loading || movies.length === 0) return null;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 mb-10">
      {/* HEADER SECTION */}
      <div className="relative z-20 flex items-center justify-between font-bold mb-4">
        <div className="flex items-center gap-2">
          <SparklesIcon className="w-6 h-6 text-primary" />
          <h2 className="text-xl sm:text-2xl text-white tracking-tight">
            Có thể bạn sẽ thích
          </h2>
        </div>
      </div>

      {/* CAROUSEL SLIDER */}
      <Carousel opts={{ align: "start", slidesToScroll: "auto" }}>
        <CarouselContent>
          {movies.map((movie) => (
            <CarouselItem
              key={movie.movie_slug}
              className="!basis-[46%] sm:!basis-1/3 md:!basis-1/4 lg:!basis-1/6 py-4"
            >
              <MovieCard
                movie_slug={movie.movie_slug}
                name={movie.name}
                thumb_url={movie.thumb_url}
                episode_current={movie.episode_current || "Tập mới"}
                reason={movie.reason}
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
