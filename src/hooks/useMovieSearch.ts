"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { debounce } from "lodash-es";
import { PageMoviesData } from "@/types";

export function useMovieSearch(limit: number = 10) {
  // State quản lý text input để UI mượt mà
  const [query, setQuery] = useState("");
  // State đã qua debounce để kích hoạt react-query fetch data
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // 1. Logic Debounce chuẩn: Chỉ chạy 1 lần duy nhất trong vòng đời component
  const debouncedSetQuery = useCallback(
    debounce((val: string) => {
      setDebouncedQuery(val.trim());
    }, 600),
    [],
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSetQuery.cancel();
    };
  }, [debouncedSetQuery]);

  // 2. Hàm xử lý sự kiện onChange (Được gọi từ input)
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
      // Chỉ fetch nếu từ khóa dài hơn 1 ký tự
      if (!debouncedQuery || debouncedQuery.length < 2)
        return { items: [] } as any;

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
    // Quan trọng: Chỉ enable query khi từ khóa hợp lệ
    enabled: debouncedQuery.length >= 2,
    staleTime: 1000 * 60 * 5, // Cache kết quả tìm kiếm trong 5 phút
  });

  // 4. Data Processing (Memoized để tối ưu render)

  // Trích xuất mảng phim đã làm phẳng (Flatten) từ các trang
  const movies = useMemo(
    () => result.data?.pages.flatMap((page) => page.items) || [],
    [result.data],
  );

  // Lấy tổng số lượng phim từ trang đầu tiên
  const totalItems = useMemo(
    () => result.data?.pages[0]?.params?.pagination?.totalItems || 0,
    [result.data],
  );

  // 5. Helper function để reset tìm kiếm
  const clearSearch = useCallback(() => {
    setQuery("");
    setDebouncedQuery("");
    debouncedSetQuery.cancel(); // Hủy các lệnh debounce đang chờ
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
