"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import VideoPlayer from "@/components/VideoPlayer";
import EpisodeList from "@/components/EpisodeList";

import { Movie, ServerData } from "@/lib/types";
import { convertToEmbedUrl } from "@/lib/utils";

interface WatchMovieProps {
  movie: Movie;
}

const WatchMovie = ({ movie }: WatchMovieProps) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tap = searchParams.get("tap");

  const [currentServerData, setCurrentServerData] = useState<ServerData | null>(
    null
  );

  useEffect(() => {
    const initialServerData = movie.episodes
      .flatMap((episode) => episode.server_data)
      .find((sv) => sv.slug === tap || Number(sv.slug) === Number(tap));

    if (initialServerData) {
      setCurrentServerData(initialServerData);
    }
  }, [tap, movie.episodes]);

  const handleChangeServer = (serverData: ServerData) => {
    setCurrentServerData(serverData);
    router.push(`?tap=${serverData.slug}#video`);
  };

  return (
    <>
      {currentServerData && (
        <VideoPlayer
          movieSrc={currentServerData.link_embed}
          movieName={movie.name + " - Tập " + currentServerData.name}
        />
      )}

      {movie.status === "trailer" ? (
        <VideoPlayer
          movieSrc={convertToEmbedUrl(movie.trailer_url)}
          movieName={movie.name + " - Trailer"}
        />
      ) : (
        <EpisodeList
          servers={movie.episodes}
          episodeSelected={tap}
          onSelect={handleChangeServer}
        />
      )}
    </>
  );
};

export default WatchMovie;
