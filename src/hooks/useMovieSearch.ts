"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { debounce } from "lodash-es";
import { ModalSearchCursor, ModalSearchResponse } from "@/services/movie-sources/types";

export function useMovieSearch(limit: number = 10) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [topKeywords, setTopKeywords] = useState<string[]>([]);
  const queuedFallbackKeysRef = useRef(new Set<string>());

  const debouncedSetQuery = useMemo(
    () =>
      debounce((val: string) => {
        setDebouncedQuery(val.trim());
      }, 300),
    [],
  );

  // Cleanup debounce khi unmount để tránh memory leak
  useEffect(() => {
    fetch("/api/movies/search-top?limit=5")
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data: { items?: string[] }) => setTopKeywords(data.items || []))
      .catch(() => setTopKeywords([]));

    return () => {
      debouncedSetQuery.cancel();
    };
  }, [debouncedSetQuery]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (val.trim()) {
      setIsOpen(true);
      debouncedSetQuery(val);
    } else {
      setIsOpen(false);
      setDebouncedQuery("");
    }
  };

  // 3. Quản lý Fetching bằng TanStack Query
  const result = useInfiniteQuery<ModalSearchResponse>({
    queryKey: ["searchMovies", debouncedQuery],
    queryFn: async ({ pageParam = null }) => {
      if (!debouncedQuery || debouncedQuery.length < 2) {
        return {
          items: [],
          nextCursor: null,
          params: {
            type_slug: "tim-kiem",
            filterCategory: [],
            filterCountry: [],
            filterYear: "",
            filterType: "",
            sortField: "",
            sortType: "",
            pagination: {
              totalItems: 0,
              totalItemsPerPage: limit,
              currentPage: 1,
              pageRanges: 5,
            },
          },
          titlePage: "",
          breadCrumb: [],
          seoOnPage: {
            titleHead: "",
            descriptionHead: "",
            og_type: "",
            og_image: [],
            og_url: "",
          },
        } as ModalSearchResponse;
      }

      const cursor = pageParam as ModalSearchCursor | null;
      const params = new URLSearchParams({
        keyword: debouncedQuery,
        limit: String(limit),
      });
      if (cursor) params.set("cursor", JSON.stringify(cursor));

      const res = await fetch(`/api/movies/search-modal?${params.toString()}`);

      if (!res.ok) throw new Error("Search API failed");
      return res.json();
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    enabled: debouncedQuery.length >= 2,
    staleTime: 1000 * 60 * 5,
  });

  const movies = useMemo(
    () => result.data?.pages.flatMap((page) => page.items) || [],
    [result.data],
  );

  const totalItems = useMemo(
    () =>
      Math.max(
        movies.length,
        ...(result.data?.pages.map((page) => page.params?.pagination?.totalItems || 0) || [0]),
      ),
    [movies.length, result.data],
  );

  const latestPage = result.data?.pages.at(-1);
  const searchPhase = latestPage?.searchPhase || "db";

  useEffect(() => {
    const fallbackMovies =
      result.data?.pages
        .filter((page) => page.searchPhase === "fallback")
        .flatMap((page) => page.items)
        .filter((movie) => {
          if (!movie.source || !["ophim", "phimapi"].includes(movie.source)) return false;
          const key = `${movie.source}:${movie.sourceSlug || movie.slug}`;
          if (queuedFallbackKeysRef.current.has(key)) return false;
          queuedFallbackKeysRef.current.add(key);
          return true;
        }) || [];

    if (fallbackMovies.length === 0) return;

    fetch("/api/movies/discovered", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movies: fallbackMovies }),
      keepalive: true,
    }).catch(() => undefined);
  }, [result.data]);

  const isFallbackSearching = Boolean(
    latestPage?.isFallbackSearching && (result.isFetching || result.isFetchingNextPage),
  );
  const isSearchComplete = Boolean(
    result.data?.pages.length &&
      !result.hasNextPage &&
      !result.isFetching &&
      !result.isFetchingNextPage,
  );

  const selectKeyword = useCallback((keyword: string) => {
    setQuery(keyword);
    setDebouncedQuery(keyword);
    setIsOpen(true);
    debouncedSetQuery.cancel();
  }, [debouncedSetQuery]);

  const trackTopKeyword = useCallback((keyword: string) => {
    fetch("/api/movies/search-top", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword }),
      keepalive: true,
    }).catch(() => undefined);
  }, []);

  const clearSearch = useCallback(() => {
    setQuery("");
    setDebouncedQuery("");
    debouncedSetQuery.cancel();
  }, [debouncedSetQuery]);

  return {
    ...result,
    query,
    setQuery,
    isOpen,
    setIsOpen,
    handleSearchChange,
    movies,
    totalItems,
    topKeywords,
    searchPhase,
    isFallbackSearching,
    isSearchComplete,
    selectKeyword,
    trackTopKeyword,
    clearSearch,
  };
}
