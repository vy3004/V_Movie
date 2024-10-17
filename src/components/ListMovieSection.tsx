"use client";

import { useEffect, useState } from "react";

import MovieSection from "@/components/MovieSection";
import Loading from "@/components/Loading";

import { fetchMovies } from "@/lib/apiClient";
import { typesMovie } from "@/lib/configs";
import { Movie } from "@/lib/types";

type MoviesData = {
  single: Movie[];
  series: Movie[];
  tv_shows: Movie[];
  anime: Movie[];
};

type TypesMovieKeys = keyof typeof typesMovie;

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
    const currentYear = new Date().getFullYear();

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
              typesMovie[section.toUpperCase() as TypesMovieKeys].slug;

            const data = await fetchMovies(
              pathName,
              "1",
              currentYear.toString()
            );

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
          title={typesMovie.SINGLE.name}
          movies={moviesData.single}
          hrefViewMore={typesMovie.SINGLE.slug}
        />
      )}
      {moviesData.series.length > 0 && (
        <MovieSection
          title={typesMovie.SERIES.name}
          movies={moviesData.series}
          hrefViewMore={typesMovie.SERIES.slug}
        />
      )}
      {moviesData.tv_shows.length > 0 && (
        <MovieSection
          title={typesMovie.TV_SHOWS.name}
          movies={moviesData.tv_shows}
          hrefViewMore={typesMovie.TV_SHOWS.slug}
        />
      )}
      {moviesData.anime.length > 0 && (
        <MovieSection
          title={typesMovie.ANIME.name}
          movies={moviesData.anime}
          hrefViewMore={typesMovie.ANIME.slug}
        />
      )}
      {loading && <Loading />}
    </div>
  );
};

export default ListMovieSection;
