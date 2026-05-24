"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import NProgress from "nprogress";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  ExclamationCircleIcon,
  ArrowTrendingUpIcon,
} from "@heroicons/react/24/outline";

import { Movie } from "@/types";
import { useMovieSearch } from "@/hooks/useMovieSearch";
import { getMovieHref } from "@/services/movie-sources/utils";
import SearchMovieResultCard from "@/components/shared/SearchMovieResultCard";
import {
  SearchFormValues,
  searchSchema,
} from "@/lib/validations/movie.validation";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function SearchModal({ isOpen, onClose }: Props) {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(-1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastAutoFetchSizeRef = useRef(-1);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SearchFormValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: { keyword: "" },
  });
  const keyword = watch("keyword");

  const {
    handleSearchChange: hookSearchChange,
    movies,
    totalItems,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    topKeywords,
    loadTopKeywords,
    searchPhase,
    isFallbackSearching,
    isSearchComplete,
    selectKeyword,
    trackTopKeyword,
    clearSearch: clearSearchState,
  } = useMovieSearch(10);

  const showNotFound =
    (keyword || "").trim().length >= 2 &&
    movies.length === 0 &&
    !isFetching &&
    !isFetchingNextPage &&
    isSearchComplete &&
    searchPhase === "done";

  useEffect(() => {
    lastAutoFetchSizeRef.current = -1;
  }, [keyword]);

  useEffect(() => {
    if (
      isOpen &&
      (keyword || "").trim().length >= 2 &&
      movies.length === 0 &&
      hasNextPage &&
      !isFetching &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isOpen,
    keyword,
    movies.length,
  ]);

  const handleResultsScroll = () => {
    const container = scrollContainerRef.current;
    if (!container || !hasNextPage || isFetchingNextPage) return;

    const distanceToBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceToBottom < 160) {
      if (lastAutoFetchSizeRef.current === movies.length) return;
      lastAutoFetchSizeRef.current = movies.length;
      fetchNextPage();
    }
  };

  const {
    ref: inputRef,
    onChange: rhfOnChange,
    ...inputRest
  } = register("keyword");

  // Focus ô input khi mở Modal
  useEffect(() => {
    if (isOpen) {
      loadTopKeywords();
      const timer = setTimeout(
        () => document.getElementById("search-input")?.focus(),
        100,
      );
      return () => clearTimeout(timer);
    }
  }, [isOpen, loadTopKeywords]);

  const moveActiveIndex = (nextIndex: number) => {
    setActiveIndex(nextIndex);
    requestAnimationFrame(() => {
      const activeEl = document.getElementById(`search-item-${nextIndex}`);
      activeEl?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  };

  // 4. Functions xử lý Event
  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    rhfOnChange(e);
    hookSearchChange(e);
    setActiveIndex(-1);
  };

  const clearSearchInput = () => {
    setValue("keyword", "");
    clearSearchState();
    setActiveIndex(-1);
    document.getElementById("search-input")?.focus();
  };

  const handleClose = () => {
    setValue("keyword", "");
    clearSearchState();
    setActiveIndex(-1);
    onClose();
  };

  const handleTopKeywordClick = (nextKeyword: string) => {
    setValue("keyword", nextKeyword);
    selectKeyword(nextKeyword);
    setActiveIndex(-1);
  };

  const handleMovieSelect = (movie: Movie) => {
    trackTopKeyword(movie.name);
    NProgress.start();
    router.push(getMovieHref(movie));
    handleClose();
  };

  const onFormSubmit = (data: SearchFormValues) => {
    if (activeIndex === -1 && data.keyword && data.keyword.trim().length >= 2) {
      NProgress.start();
      router.push(
        `/tim-kiem?keyword=${encodeURIComponent(data.keyword.trim())}`,
      );
      handleClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActiveIndex(
        activeIndex < movies.length - 1 ? activeIndex + 1 : activeIndex,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActiveIndex(activeIndex > -1 ? activeIndex - 1 : -1);
    } else if (e.key === "Enter" && activeIndex !== -1) {
      e.preventDefault();
      const selectedMovie = movies[activeIndex];
      if (!selectedMovie) return;
      handleMovieSelect(selectedMovie);
    } else if (e.key === "Escape") {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[999] flex justify-center pt-10 sm:pt-20 px-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={handleClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-2xl bg-[#1c1c1e] border border-zinc-800 rounded-xl shadow-2xl flex flex-col max-h-[60vh] md:max-h-[80vh] overflow-hidden animate-in zoom-in-95 duration-200">
        {/* HEADER & FORM */}
        <form
          onSubmit={handleSubmit(onFormSubmit)}
          className="flex flex-col border-b border-zinc-800/50 relative"
        >
          <div className="flex items-center px-5 py-4">
            <MagnifyingGlassIcon className="w-6 h-6 text-zinc-500 mr-3" />
            <input
              id="search-input"
              type="text"
              {...inputRest}
              ref={inputRef}
              onChange={onInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Nhập từ khóa (tối thiểu 2 ký tự)"
              className="flex-1 bg-transparent text-white text-lg outline-none"
              autoComplete="off"
            />
            <div className="flex items-center gap-3">
              {isFetching && !isFetchingNextPage ? (
                <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
              ) : keyword ? (
                <button
                  type="button"
                  onClick={clearSearchInput}
                  className="p-1 hover:bg-zinc-800 rounded-full"
                >
                  <XMarkIcon className="w-5 h-5 text-zinc-400" />
                </button>
              ) : null}
              <kbd className="hidden sm:block px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-500">
                ESC
              </kbd>
            </div>
          </div>
          {errors.keyword && (
            <span className="absolute bottom-1 left-14 text-xs text-red-500 font-medium">
              {errors.keyword.message}
            </span>
          )}
        </form>

        {/* RESULTS AREA */}
        <div
          ref={scrollContainerRef}
          onScroll={handleResultsScroll}
          className="flex-1 overflow-y-auto custom-scrollbar p-2"
        >
          {!keyword || keyword.length < 2 ? (
            <div className="h-64 flex flex-col items-center justify-center text-zinc-500 px-4">
              {topKeywords.length > 0 ? (
                <div className="w-full h-full space-y-2">
                  <p className="text-sm font-bold tracking-widest text-zinc-600">
                    Tìm kiếm hot
                  </p>
                  {topKeywords.slice(0, 5).map((topKeyword) => (
                    <button
                      key={topKeyword}
                      type="button"
                      onClick={() => handleTopKeywordClick(topKeyword)}
                      className="flex w-full items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-left text-sm font-semibold text-zinc-300 hover:border-primary hover:text-white transition-colors"
                    >
                      <ArrowTrendingUpIcon className="h-4 w-4 shrink-0 text-emerald-400" />
                      <span className="line-clamp-1">{topKeyword}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <MagnifyingGlassIcon className="w-12 h-12 mb-3 opacity-20" />
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {totalItems > 0 && (
                <div className="px-3 py-2 text-[11px] font-bold text-zinc-500 uppercase tracking-widest flex justify-between">
                  <span>Kết quả tìm kiếm</span>
                  <span className="text-indigo-400">
                    Tìm thấy {totalItems.toLocaleString()}{hasNextPage ? "+" : ""} phim
                  </span>
                </div>
              )}
              {isFetching && !isFetchingNextPage && movies.length === 0 && (
                <div className="space-y-1">
                  {[1, 2, 3].map((i) => (
                    <SearchSkeleton key={i} />
                  ))}
                </div>
              )}

              {movies.map((movie: Movie, index: number) => (
                <Link
                  key={`${movie.source || "db"}:${movie.sourceSlug || movie.slug || movie._id}`}
                  id={`search-item-${index}`}
                  href={getMovieHref(movie)}
                  onClick={() => handleMovieSelect(movie)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex gap-4 p-3 rounded-xl transition-all border border-transparent ${
                    activeIndex === index
                      ? "shadow-lg scale-[1.01] !border-red-500 bg-zinc-800/50"
                      : ""
                  }`}
                >
                  <SearchMovieResultCard movie={movie} active={activeIndex === index} showEnterHint={activeIndex === index} className="flex-1" />
                </Link>
              ))}

              {isFallbackSearching && (
                <div className="px-3 py-2 text-xs font-semibold text-indigo-300">
                  Đang tìm trong nguồn phim dự phòng...
                </div>
              )}

              {isFetchingNextPage && (
                <div className="space-y-1">
                  {[1, 2].map((i) => (
                    <SearchSkeleton key={i} />
                  ))}
                </div>
              )}

              {hasNextPage && <div className="h-4" />}

              {showNotFound && (
                <div className="py-20 flex flex-col items-center text-zinc-500">
                  <ExclamationCircleIcon className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-sm">Không tìm thấy phim phù hợp</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="flex items-center gap-4 px-5 py-2 bg-black/40 border-t border-zinc-800/50 text-[12px] text-zinc-500 font-bold">
          <span className="flex items-center gap-2">
            <span className="px-2 text-[16px] bg-zinc-800 rounded">↵</span> Chọn
          </span>
          <span className="flex items-center gap-2">
            <span className="px-[7px] py-[3px] bg-zinc-800 rounded">↑↓</span>{" "}
            Duyệt
          </span>
        </div>
      </div>
    </div>
  );
}

const SearchSkeleton = () => (
  <div className="flex gap-4 p-3 animate-pulse">
    <div className="w-14 sm:w-16 aspect-[2/3] bg-zinc-800 rounded-lg" />
    <div className="flex-1 py-2 space-y-2">
      <div className="h-4 bg-zinc-800 rounded w-3/4" />
      <div className="h-3 bg-zinc-800 rounded w-1/2" />
    </div>
  </div>
);
