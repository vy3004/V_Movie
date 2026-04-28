"use client";

import React, { useState, useEffect, useRef } from "react";
import { useInView } from "react-intersection-observer";
import { toast } from "sonner";
import {
  ClockIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CheckBadgeIcon,
  PlayCircleIcon,
  InboxIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import HistoryCard from "@/components/shared/HistoryCard";
import LoadingPage from "@/components/ui/LoadingPage";
import Loading from "@/components/ui/Loading";
import ConfirmModal from "@/components/ui/ConfirmModal";
import StatCard from "@/app/(dashboard)/dashboard/_components/StatCard";
import { useHistoryList } from "@/hooks/useHistory";

type FilterType = "all" | "watching" | "finished";

export default function HistoryPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  // State điều khiển UI
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isModalClearOpen, setIsModalClearOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    historyList,
    stats,
    isLoading,
    isFetching,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    deleteItem,
    clearAll,
  } = useHistoryList({
    limit: 16,
    filter,
    keyword: debouncedSearch,
    withStats: true,
  });

  const { ref, inView } = useInView();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Click outside đóng menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (inView && hasNextPage) fetchNextPage();
  }, [inView, hasNextPage, fetchNextPage]);

  if (isLoading && historyList.length === 0) return <LoadingPage />;

  const filterOptions = [
    { id: "all", label: "Tất cả", icon: FunnelIcon },
    { id: "watching", label: "Đang xem", icon: PlayCircleIcon },
    { id: "finished", label: "Đã xong", icon: CheckBadgeIcon },
  ];

  const currentFilterLabel = filterOptions.find((f) => f.id === filter)?.label;

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700">
      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-black text-white flex items-center gap-3">
          <ClockIcon className="w-8 h-8 text-red-500" /> Lịch sử xem
        </h1>
        <p className="text-zinc-500 mt-1">
          Nơi lưu giữ hành trình điện ảnh của bạn.
        </p>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard
          icon={InboxIcon}
          label="Tổng phim"
          value={stats?.total ?? 0}
          color="red"
        />
        <StatCard
          icon={CheckBadgeIcon}
          label="Đã xong"
          value={stats?.finished ?? 0}
          color="emerald"
        />
        <StatCard
          icon={PlayCircleIcon}
          label="Đang cày"
          value={stats?.watching ?? 0}
          color="blue"
          className="hidden md:flex"
        />
      </div>

      {/* ACTIONS BAR (SEARCH + FILTER + CLEAR) */}
      <div className="sticky top-16 z-20 flex items-center gap-3 p-2 bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 rounded-3xl shadow-2xl">
        {/* Search Input */}
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-zinc-500" />
          <input
            type="text"
            placeholder="Tìm phim..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900/50 border border-transparent focus:border-zinc-700 rounded-2xl py-3 pl-12 pr-4 text-sm text-white outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-2 pr-1" ref={menuRef}>
          {/* Nút Xóa tất cả */}
          {(stats?.total ?? 0) > 0 && (
            <button
              onClick={() => setIsModalClearOpen(true)}
              className="p-3 bg-zinc-900 hover:bg-red-600/10 text-zinc-400 hover:text-red-500 rounded-2xl border border-zinc-800 transition-all active:scale-95"
              title="Xóa tất cả"
            >
              <TrashIcon className="size-5" />
            </button>
          )}

          {/* Nút Filter Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`flex items-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm transition-all active:scale-95 border ${
                isFilterOpen
                  ? "bg-white text-black border-white"
                  : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700"
              }`}
            >
              <FunnelIcon className="size-4" />
              <span className="hidden sm:inline uppercase tracking-wider">
                {currentFilterLabel}
              </span>
              <ChevronDownIcon
                className={`size-3 transition-transform duration-300 ${isFilterOpen ? "rotate-180" : ""}`}
              />
            </button>

            {/* Menu Dropdown */}
            {isFilterOpen && (
              <div className="absolute right-0 mt-2 p-2 space-y-2 w-40 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {filterOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setFilter(opt.id as FilterType);
                      setIsFilterOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                      filter === opt.id
                        ? "bg-white/10 text-white"
                        : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                    }`}
                  >
                    <opt.icon className="size-4" />
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* LIST CONTENT */}
      <div
        className={`transition-opacity duration-300 ${isFetching && !isFetchingNextPage ? "opacity-50" : "opacity-100"}`}
      >
        {historyList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-zinc-900/10 rounded-[3rem] border border-dashed border-zinc-800">
            <InboxIcon className="size-12 text-zinc-800 mb-4" />
            <p className="text-zinc-500 font-medium">Lịch sử trống</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {historyList.map((item) => (
              <div key={item.movie_slug} className="relative group">
                <HistoryCard
                  item={item}
                  type={item.is_finished ? "finished" : "watching"}
                />
                <button
                  onClick={() => deleteItem(item.movie_slug)}
                  className="absolute top-2 right-2 p-2 bg-black/60 backdrop-blur-md rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-red-600 transition-all z-10 shadow-lg sm:opacity-0 max-sm:opacity-100"
                  aria-label="Xóa khỏi lịch sử"
                >
                  <TrashIcon className="size-4 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* INFINITE SCROLL */}
      {hasNextPage && (
        <div ref={ref} className="py-10 flex justify-center">
          {isFetchingNextPage ? <Loading /> : <div className="h-10" />}
        </div>
      )}

      {/* MODAL XÁC NHẬN XÓA TẤT CẢ */}
      <ConfirmModal
        isOpen={isModalClearOpen}
        isLoading={false}
        title="Xóa toàn bộ lịch sử?"
        description="Hành động này sẽ xóa vĩnh viễn tất cả phim bạn đã xem khỏi danh sách. Bạn chắc chắn chứ?"
        confirmText="Vâng, xóa hết"
        cancelText="Để sau"
        onClose={() => setIsModalClearOpen(false)}
        onConfirm={async () => {
          try {
            await clearAll();
            setIsModalClearOpen(false);
          } catch {
            toast.error("Lỗi khi xóa lịch sử.");
          }
        }}
      />
    </div>
  );
}
