"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useInView } from "react-intersection-observer";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  HeartIcon,
  BookmarkIcon,
  MagnifyingGlassIcon,
  BellIcon,
  BellAlertIcon,
  CheckCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import MovieCard from "@/components/MovieCard";
import LoadingPage from "@/components/LoadingPage";
import Loading from "@/components/Loading";
import ConfirmModal from "@/components/ConfirmModal";
import StatCard from "@/components/StatCard";
import { formatEpisodeName } from "@/lib/utils";
import { useSubscriptionList } from "@/hooks/useSubscription";

export default function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const { ref, inView } = useInView();

  // 1. States cho Tìm kiếm & Lọc
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isOnlyNew, setIsOnlyNew] = useState(false);

  // State cho Modal Xóa
  const [deletingMovie, setDeletingMovie] = useState<{
    slug: string;
    name: string;
  } | null>(null);

  // Debounce Search (Chờ 500ms sau khi ngừng gõ mới gọi API)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // 2. Gọi Hook với params cho Server
  const {
    subscriptions,
    total,
    hasNewCount,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useSubscriptionList({
    limit: 15,
    filter: isOnlyNew ? "new" : "all",
    keyword: debouncedSearch,
    withStats: true, // Chắc chắn bật Stats ở trang này
  });

  // 3. Trigger Infinite Scroll
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // 4. Mutation Hủy đăng ký nhanh tại trang
  const unsubscribeMutation = useMutation({
    mutationFn: async (slug: string) => {
      const res = await fetch(`/api/subscriptions?movieSlug=${slug}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Lỗi khi hủy đăng ký");
    },
    onSuccess: () => {
      toast.success("Đã hủy đăng ký thành công");
      // Cập nhật lại list và stats tức thì
      queryClient.invalidateQueries({ queryKey: ["subscriptions-list"] });
      queryClient.invalidateQueries({ queryKey: ["subscriptions-stats"] });
      setDeletingMovie(null);
    },
    onError: () => {
      toast.error("Hủy đăng ký thất bại!");
      setDeletingMovie(null);
    },
  });

  const caughtUp = useMemo(
    () => Math.max(0, total - hasNewCount),
    [total, hasNewCount],
  );

  if (isLoading && subscriptions.length === 0) return <LoadingPage />;

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <HeartIcon className="w-8 h-8 text-rose-500" />
            Phim đã đăng ký
          </h1>
          <p className="text-zinc-500 mt-1">
            Theo dõi và nhận thông báo khi có tập phim mới nhất.
          </p>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard
          icon={BookmarkIcon}
          label="Tổng đăng ký"
          value={total}
          color="rose"
        />
        <StatCard
          icon={BellAlertIcon}
          label="Cập nhật mới"
          value={hasNewCount}
          color="amber"
        />
        <StatCard
          icon={CheckCircleIcon}
          label="Đã bắt kịp"
          value={caughtUp}
          color="emerald"
          className="hidden md:flex"
        />
      </div>

      {/* ACTIONS BAR */}
      <div className="sticky top-16 z-10 flex items-center gap-3 p-2 bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 rounded-3xl shadow-2xl">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-zinc-500" />
          <input
            type="text"
            placeholder="Tìm phim trong danh sách..."
            aria-label="Tìm kiếm phim"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900/50 border border-transparent focus:border-zinc-700 rounded-2xl py-3 pl-12 pr-4 text-sm text-white outline-none transition-all"
          />
        </div>

        {/* Nút Lọc "Tập mới" kiểu Toggle */}
        <button
          onClick={() => setIsOnlyNew(!isOnlyNew)}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all border shrink-0 ${
            isOnlyNew
              ? "bg-amber-500/10 text-amber-500 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
              : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
          }`}
        >
          {isOnlyNew ? (
            <BellAlertIcon className="size-4 animate-pulse" />
          ) : (
            <BellIcon className="size-4" />
          )}
          <span className="hidden sm:inline">Tập mới</span>
        </button>
      </div>

      {/* GRID CONTENT */}
      {subscriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 bg-zinc-900/10 rounded-[3.5rem] border border-dashed border-zinc-800 animate-in zoom-in-95 duration-500">
          <BellIcon className="size-16 text-zinc-800 mb-4" />
          <p className="text-zinc-500 font-bold text-lg">Danh sách trống</p>
          <p className="text-zinc-600 text-sm">
            Không tìm thấy phim phù hợp với bộ lọc.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 pt-2">
          {subscriptions.map((sub) => (
            <div
              key={sub.movie_slug}
              className="relative group animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
              <MovieCard
                movie_slug={sub.movie_slug}
                name={sub.movie_name}
                thumb_url={sub.movie_poster}
                episode_current={formatEpisodeName(
                  sub.last_known_episode_slug,
                  sub.has_new_episode,
                )}
              />

              {/* Nút Xóa Từng Phim (Chỉ hiện khi hover) */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setDeletingMovie({
                    slug: sub.movie_slug,
                    name: sub.movie_name,
                  });
                }}
                className="absolute -top-3 -right-3 p-2 bg-zinc-900 border border-zinc-800 rounded-full text-zinc-500 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 transition-all hover:text-rose-500 hover:border-rose-500 hover:bg-zinc-950 focus:text-rose-500 focus:border-rose-500 shadow-2xl z-20 active:scale-90"
                title="Hủy đăng ký"
              >
                <XMarkIcon className="size-4 font-black" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* CỤC LOADING CHO INFINITE SCROLL */}
      {hasNextPage && (
        <div ref={ref} className="py-8 flex justify-center">
          {isFetchingNextPage ? (
            <Loading />
          ) : (
            <div className="h-10 text-transparent">Trượt xuống để tải</div>
          )}
        </div>
      )}

      {/* MODAL CONFIRM XÓA 1 PHIM */}
      <ConfirmModal
        isOpen={!!deletingMovie}
        isLoading={unsubscribeMutation.isPending}
        title="Hủy đăng ký phim?"
        description={`Bạn sẽ không nhận được thông báo khi phim "${deletingMovie?.name}" có tập mới nữa.`}
        confirmText="Vâng, hủy đăng ký"
        cancelText="Đóng"
        onClose={() => setDeletingMovie(null)}
        onConfirm={() => {
          if (deletingMovie) unsubscribeMutation.mutate(deletingMovie.slug);
        }}
      />
    </div>
  );
}
