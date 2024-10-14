"use client";

import { useEffect, useState } from "react";

import MovieSection from "@/components/MovieSection";
import Loading from "@/components/Loading";

import { fetchMovies } from "@/lib/apiClient";
import { pathNameMovies } from "@/lib/configs";
import { Movie } from "@/lib/types";

type MoviesData = {
  single: Movie[];
  series: Movie[];
  tv_shows: Movie[];
  anime: Movie[];
};

type PathNameKeys = keyof typeof pathNameMovies;

const ListMovieSection = () => {
  const [moviesData, setMoviesData] = useState<MoviesData>({
    single: [],
    series: [],
    tv_shows: [],
    anime: [],
  });
  const [loadMore, setLoadMore] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const handleScroll = () => {
      const bottom =
        Math.ceil(window.innerHeight + window.scrollY) >=
        document.documentElement.scrollHeight;

      if (bottom && !loadMore && !loading) {
        setLoadMore(true);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loadMore, loading]);

  useEffect(() => {
    const loadMovies = async () => {
      if (loadMore) {
        setLoading(true);

        const sections: (keyof MoviesData)[] = [
          "single",
          "series",
          "tv_shows",
          "anime",
        ];

        for (const section of sections) {
          if (moviesData[section].length === 0) {
            const pathName =
              pathNameMovies[section.toUpperCase() as PathNameKeys];

            const data = await fetchMovies(pathName, 1);

            setMoviesData((prev) => ({
              ...prev,
              [section]: data.items,
            }));
            setLoadMore(false);

            break;
          }
        }

        setLoading(false);
      }
    };

    loadMovies();
  }, [loadMore, moviesData]);

  return (
    <div className="space-y-12">
      {moviesData.single.length > 0 && (
        <MovieSection
          title="Phim lẻ"
          movies={moviesData.single}
          hrefViewMore="/phim-le"
        />
      )}
      {moviesData.series.length > 0 && (
        <MovieSection
          title="Phim bộ"
          movies={moviesData.series}
          hrefViewMore="/phim-bo"
        />
      )}
      {moviesData.tv_shows.length > 0 && (
        <MovieSection
          title="Truyền hình"
          movies={moviesData.tv_shows}
          hrefViewMore="/tv-shows"
        />
      )}
      {moviesData.anime.length > 0 && (
        <MovieSection
          title="Hoạt hình"
          movies={moviesData.anime}
          hrefViewMore="/hoat-hinh"
        />
      )}
      {loading && <Loading />}
    </div>
  );
};

export default ListMovieSection;
