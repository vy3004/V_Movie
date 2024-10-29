import Link from "next/link";
import Image from "next/image";
import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";

import Loading from "@/components/Loading";
import { BorderedItem } from "@/components/MovieDetail";

import { fetchMovies } from "@/lib/apiClient";
import { apiConfig } from "@/lib/configs";

const SearchInput = () => {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(query), 1000);
    return () => clearTimeout(handler);
  }, [query]);

  const { data: movies = [], isLoading } = useQuery({
    queryKey: ["searchMovies", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery) return [];
      const result = await fetchMovies("tim-kiem", { keyword: debouncedQuery });
      return result.items;
    },
    enabled: !!debouncedQuery,
  });

  const isTyping = query !== debouncedQuery || isLoading;

  const handleKeyEnterDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && query.trim() !== "") {
      router.push(`/tim-kiem?keyword=${encodeURIComponent(query)}`);
      setQuery("");
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center justify-between gap-1 border rounded-lg px-2 py-1">
        <input
          placeholder="Tìm kiếm..."
          className="bg-transparent w-24 sm:w-32 outline-none"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyEnterDown}
        />
        <MagnifyingGlassIcon className="size-6" />
      </div>

      {query.trim() !== "" && (
        <>
          {isTyping ? (
            <DropdownResult className="w-full">
              <Loading />
            </DropdownResult>
          ) : movies.length > 0 ? (
            <DropdownResult className="max-h-96 max-w-80 sm:max-w-96 w-max overflow-y-scroll space-y-2">
              {movies.map((movie) => (
                <Link
                  key={movie._id}
                  href={`/phim/${movie.slug}`}
                  onClick={() => setQuery("")}
                  className="space-y-2 group grid grid-cols-3 gap-2 hover:bg-secondary rounded-lg p-1"
                >
                  <div className="relative aspect-square rounded overflow-hidden">
                    <Image
                      src={`${apiConfig.IMG_URL}${movie.thumb_url}`}
                      alt={movie.origin_name}
                      fill
                      placeholder="blur"
                      blurDataURL="/blur_img.webp"
                      className="absolute inset-0 size-full object-cover"
                    />
                  </div>
                  <div className="col-span-2">
                    <h3 className="line-clamp-2 text-primary font-semibold text-sm sm:text-base">
                      {movie.name}
                    </h3>
                    <h6 className="line-clamp-1 text-xs sm:text-sm">
                      ({movie.origin_name})
                    </h6>
                    <div className="flex items-center gap-2 text-xs sm:text-sm mt-2">
                      <BorderedItem>{movie.year}</BorderedItem>
                      <BorderedItem>{movie.episode_current}</BorderedItem>
                    </div>
                  </div>
                </Link>
              ))}
            </DropdownResult>
          ) : (
            <DropdownResult className="w-full">Không tìm thấy</DropdownResult>
          )}
        </>
      )}
    </div>
  );
};

export default SearchInput;

const DropdownResult = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`absolute right-0 mt-2 bg-gray-800 rounded-lg p-2 z-10 ${className}`}
  >
    {children}
  </div>
);
