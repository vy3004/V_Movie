"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { Movie, HistoryItem } from "@/lib/types";
import { useWatchHistory } from "@/hooks/useWatchHistory";
import WatchMovie from "@/components/WatchMovie";

interface WatchMovieWithHistoryProps {
  movie: Movie;
  history?: HistoryItem | null;
  user: User | null | undefined;
}

export default function WatchMovieWithHistory({
  movie,
  history,
  user,
}: WatchMovieWithHistoryProps) {
  // Get the episode slug from URL params using Next.js hook
  const searchParams = useSearchParams();
  const episodeSlug =
    searchParams?.get("tap") || movie?.episodes[0]?.server_data[0]?.slug || "";

  // Use the watch history hook
  const { handleTimeUpdate, handlePause } = useWatchHistory({
    user,
    movie,
    episodeSlug,
  });

  return (
    <WatchMovie
      movie={movie}
      history={history}
      user={user as User | null}
      handleTimeUpdate={handleTimeUpdate}
      handlePause={handlePause}
    />
  );
}
