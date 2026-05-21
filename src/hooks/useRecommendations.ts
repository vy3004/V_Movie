"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { generateSlug } from "@/lib/utils";
import { useData } from "@/providers/BaseDataContextProvider";
import { HistoryItem, MovieRecommendation } from "@/types";

interface RecommendationsResponse {
  movies: MovieRecommendation[];
  isGuest: boolean;
}

function getGuestRecommendationContext() {
  if (typeof window === "undefined") return null;

  const localHistoryStr = localStorage.getItem("v_movie_guest_history");
  if (!localHistoryStr) return null;

  let history: HistoryItem[] = [];
  try {
    const parsed = JSON.parse(localHistoryStr);
    history = (
      Array.isArray(parsed) ? parsed : Object.values(parsed)
    ) as HistoryItem[];
  } catch {
    return null;
  }

  const genre_counts: Record<string, number> = {};
  const recently_finished: string[] = [];
  const currently_watching: string[] = [];

  history.forEach((movie) => {
    const hasMeaningfulView =
      movie.is_finished ||
      (movie.episodes_progress &&
        Object.values(movie.episodes_progress).some(
          (episode) =>
            episode.ep_is_finished ||
            episode.ep_last_time > 300 ||
            (episode.ep_duration > 0 &&
              episode.ep_last_time > episode.ep_duration * 0.1),
        ));

    if (!hasMeaningfulView) return;

    movie.movie_metadata?.genres?.forEach((rawGenre) => {
      const slug = generateSlug(rawGenre || "");
      if (slug) genre_counts[slug] = (genre_counts[slug] || 0) + 1;
    });

    if (!movie.movie_name) return;
    if (movie.is_finished && recently_finished.length < 5)
      recently_finished.push(movie.movie_name);
    if (!movie.is_finished && currently_watching.length < 5)
      currently_watching.push(movie.movie_name);
  });

  if (Object.keys(genre_counts).length === 0) return null;
  return { genre_counts, recently_finished, currently_watching };
}

async function fetchGuestRecommendations(): Promise<MovieRecommendation[]> {
  const context = getGuestRecommendationContext();
  if (!context) return [];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch("/api/recommend/guest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(context),
      signal: controller.signal,
    });
    if (!res.ok)
      throw new Error(`Failed to fetch guest recommendations: ${res.status}`);

    const data = await res.json();
    return data.success && Array.isArray(data.movies) ? data.movies : [];
  } finally {
    clearTimeout(timeoutId);
  }
}

export function useRecommendations() {
  const queryClient = useQueryClient();
  const { user, authLoading } = useData();

  const query = useQuery({
    queryKey: ["home-recommendations", user?.id || "guest"],
    queryFn: async (): Promise<RecommendationsResponse> => {
      const res = await fetch("/api/recommend/home");
      if (!res.ok)
        throw new Error(`Failed to fetch recommendations: ${res.status}`);
      const data = await res.json();
      const isGuest = Boolean(data.isGuest);
      const movies = Array.isArray(data.movies) ? data.movies : [];

      return {
        movies: isGuest ? await fetchGuestRecommendations() : movies,
        isGuest,
      };
    },
    enabled: !authLoading,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  return {
    movies: query.data?.movies || [],
    isGuest: query.data?.isGuest ?? true,
    isLoading: authLoading || query.isLoading,
    isError: query.isError,
    refresh: () =>
      queryClient.invalidateQueries({ queryKey: ["home-recommendations", user?.id || "guest"] }),
  };
}
