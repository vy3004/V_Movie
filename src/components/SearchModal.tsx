"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import NProgress from "nprogress";
import Link from "next/link";
import { useInView } from "react-intersection-observer";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";

import ImageCustom from "@/components/ImageCustom";
import { Movie } from "@/types";
import { useMovieSearch } from "@/hooks/useMovieSearch";
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
    setQuery,
    movies,
    totalItems,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMovieSearch(10);

  // Observer cuộn xuống đáy
  const { ref: loadMoreRef, inView } = useInView();

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const {
    ref: inputRef,
    onChange: rhfOnChange,
    ...inputRest
  } = register("keyword");

  // Focus ô input khi mở Modal
  useEffect(() => {
    if (isOpen)
      setTimeout(() => document.getElementById("search-input")?.focus(), 100);
  }, [isOpen]);

  useEffect(() => {
    if (activeIndex >= 0) {
      const activeEl = document.getElementById(`search-item-${activeIndex}`);
      activeEl?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeIndex]);

  // 4. Functions xử lý Event
  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    rhfOnChange(e);
    hookSearchChange(e);
    setActiveIndex(-1);
  };

  const clearSearch = () => {
    setValue("keyword", "");
    setQuery("");
    setActiveIndex(-1);
    document.getElementById("search-input")?.focus();
  };

  const onFormSubmit = (data: SearchFormValues) => {
    if (activeIndex === -1 && data.keyword && data.keyword.trim().length >= 2) {
      NProgress.start();
      router.push(
        `/tim-kiem?keyword=${encodeURIComponent(data.keyword.trim())}`,
      );
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < movies.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > -1 ? prev - 1 : -1));
    } else if (e.key === "Enter" && activeIndex !== -1) {
      e.preventDefault();
      NProgress.start();
      router.push(`/phim/${movies[activeIndex].slug}`);
      onClose();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] flex justify-center pt-10 sm:pt-20 px-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
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
              placeholder="Tìm kiếm phim..."
              className="flex-1 bg-transparent text-white text-lg outline-none"
              autoComplete="off"
            />
            <div className="flex items-center gap-3">
              {isFetching && !isFetchingNextPage ? (
                <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
              ) : keyword ? (
                <button
                  type="button"
                  onClick={clearSearch}
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
          className="flex-1 overflow-y-auto custom-scrollbar p-2"
        >
          {!keyword || keyword.length < 2 ? (
            <div className="h-64 flex flex-col items-center justify-center text-zinc-500">
              <MagnifyingGlassIcon className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm">Nhập từ khóa (tối thiểu 2 ký tự)</p>
            </div>
          ) : (
            <div className="space-y-1">
              {totalItems > 0 && (
                <div className="px-3 py-2 text-[11px] font-bold text-zinc-500 uppercase tracking-widest flex justify-between">
                  <span>Kết quả tìm kiếm</span>
                  <span className="text-indigo-400">
                    Tìm thấy {totalItems.toLocaleString()} phim
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
                  key={movie._id}
                  id={`search-item-${index}`}
                  href={`/phim/${movie.slug}`}
                  onClick={onClose}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex gap-4 p-3 rounded-xl transition-all border border-transparent ${
                    activeIndex === index
                      ? "shadow-lg scale-[1.01] !border-red-500 bg-zinc-800/50"
                      : ""
                  }`}
                >
                  <div className="relative w-14 sm:w-16 aspect-[2/3] shrink-0 rounded-lg overflow-hidden bg-zinc-900 shadow-md">
                    <ImageCustom
                      alt={movie.name}
                      src={movie.thumb_url}
                      widths={[128]}
                      className="absolute inset-0 size-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h3
                      className={`text-sm sm:text-base font-bold line-clamp-1 ${activeIndex === index ? "text-primary" : "text-zinc-200"}`}
                    >
                      {movie.name}
                    </h3>
                    <p
                      className={`text-xs sm:text-sm line-clamp-1 ${activeIndex === index ? "text-indigo-100" : "text-zinc-500"}`}
                    >
                      {movie.origin_name} • {movie.year}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-[10px] rounded-lg font-bold">
                        {movie.episode_current}
                      </span>
                      <span className="text-[10px] text-zinc-400">
                        {movie.quality} • {movie.lang}
                      </span>
                    </div>
                  </div>
                  {activeIndex === index && (
                    <div className="flex items-center pr-2">
                      <span className="text-[10px] bg-white/20 px-2 py-1 rounded text-white uppercase font-black">
                        Enter
                      </span>
                    </div>
                  )}
                </Link>
              ))}

              {isFetchingNextPage && (
                <div className="space-y-1">
                  {[1, 2].map((i) => (
                    <SearchSkeleton key={i} />
                  ))}
                </div>
              )}

              {hasNextPage && <div ref={loadMoreRef} className="h-4" />}

              {!isFetching && movies.length === 0 && (
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
