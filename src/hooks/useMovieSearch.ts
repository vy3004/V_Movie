"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { debounce } from "lodash-es";
import { PageMoviesData } from "@/types";

export function useMovieSearch(limit: number = 10) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const debouncedSetQuery = useMemo(
    () =>
      debounce((val: string) => {
        setDebouncedQuery(val.trim());
      }, 600),
    [], // dependency rỗng vì hàm không phụ thuộc vào state nào khác bên ngoài
  );

  // Cleanup debounce khi unmount để tránh memory leak
  useEffect(() => {
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
  const result = useInfiniteQuery<PageMoviesData>({
    queryKey: ["searchMovies", debouncedQuery],
    queryFn: async ({ pageParam = 1 }) => {
      if (!debouncedQuery || debouncedQuery.length < 2) {
        return {
          items: [],
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
        } as PageMoviesData;
      }

      const res = await fetch(
        `/api/movies/list?slug=tim-kiem&keyword=${encodeURIComponent(debouncedQuery)}&limit=${limit}&page=${pageParam}`,
      );

      if (!res.ok) throw new Error("Search API failed");
      return res.json();
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const pagination = lastPage?.params?.pagination;
      if (!pagination) return undefined;

      const { currentPage, totalItems, totalItemsPerPage } = pagination;
      const totalPages = Math.ceil(totalItems / totalItemsPerPage);

      return currentPage < totalPages ? currentPage + 1 : undefined;
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 1000 * 60 * 5,
  });

  const movies = useMemo(
    () => result.data?.pages.flatMap((page) => page.items) || [],
    [result.data],
  );

  const totalItems = useMemo(
    () => result.data?.pages[0]?.params?.pagination?.totalItems || 0,
    [result.data],
  );

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
    clearSearch,
  };
}
