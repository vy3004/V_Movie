"use client";

import dynamic from "next/dynamic";
import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  MagnifyingGlassIcon,
  PlusIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { useInfiniteQuery } from "@tanstack/react-query";
import { debounce } from "lodash-es";
import { useInView } from "react-intersection-observer";

import { WatchPartyRoom } from "@/types";
import { useData } from "@/providers/BaseDataContextProvider";
import { useAuthModal } from "@/providers/AuthModalProvider";

import RoomCard from "@/app/(main)/xem-chung/_components/RoomCard";
import RoomCardSkeleton from "@/app/(main)/xem-chung/_components/RoomCardSkeleton";

const ConfirmModal = dynamic(() => import("@/components/ui/ConfirmModal"), {
  ssr: false,
});

const CreateRoomModal = dynamic(
  () => import("@/app/(main)/xem-chung/_components/CreateRoomModal"),
  { ssr: false },
);

export default function WatchPartyLobbyPage() {
  const { user } = useData();
  const { onOpen: openLogin } = useAuthModal();
  const searchParams = useSearchParams();

  const [searchTerm, setSearchTerm] = useState("");
  const [querySearch, setQuerySearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showKickedModal, setShowKickedModal] = useState(
    searchParams.get("kicked") === "1",
  );

  // Intersection Observer để theo dõi đáy trang
  const { ref, inView } = useInView({
    threshold: 0.1, // Kích hoạt khi thấy 10% phần tử mồi
  });

  // 1. Logic Debounce Search
  const debouncedSearch = useRef(
    debounce((value: string) => {
      setQuerySearch(value);
    }, 500),
  ).current;

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    debouncedSearch(value);
  };

  // 2. Infinite Query Logic
  const {
    data,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    status,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ["wp-lobby", querySearch],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams({
        search: querySearch,
        page: String(pageParam),
        limit: "12",
      });
      const res = await fetch(`/api/watch-party/lobby?${params}`);
      if (!res.ok) throw new Error("Failed to fetch rooms");
      return res.json();
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });

  // 3. Tự động load trang tiếp theo khi cuộn xuống đáy
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleCreateRoomClick = () => {
    if (!user) {
      toast.info("Vui lòng đăng nhập để tạo phòng!");
      openLogin();
      return;
    }
    setShowModal(true);
  };

  const handleRefresh = async () => {
    try {
      await refetch();
      toast.success("Đã làm mới danh sách phòng!");
    } catch {
      toast.error("Không thể làm mới danh sách phòng!");
    }
  };

  const closeKickedModal = () => {
    setShowKickedModal(false);
    window.history.replaceState(null, "", "/xem-chung");
  };

  // Làm phẳng dữ liệu từ các trang (pages) thành một mảng duy nhất
  const allRooms = data?.pages.flatMap((page) => page.rooms ?? []) ?? [];
  return (
    <div className="min-h-screen bg-[#141414] text-white py-12 px-6 lg:px-12">
      {/* Header Section */}
      <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16 px-1">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-red-600 font-black text-xs tracking-widest uppercase">
            <span className="w-8 h-px bg-red-600" />
            Sảnh chờ trực tuyến
          </div>
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter uppercase italic">
            PHÒNG{" "}
            <span
              className="text-transparent stroke-text"
              style={{ WebkitTextStroke: "1px white" }}
            >
              TRỐNG
            </span>
          </h2>
          <p className="text-zinc-500 font-medium max-w-md">
            Tìm một căn phòng phù hợp với tâm trạng của bạn hoặc tự tạo không
            gian riêng cùng hội bạn thân nhé.
          </p>
          {/* Abstract Decorators */}
          <div className="absolute -bottom-10 right-20 w-48 h-48 border-[12px] border-white/5 rounded-full pointer-events-none" />
          <div className="absolute bottom-20 left-[60%] w-28 h-28 border-[12px] border-white/5 rounded-full pointer-events-none" />
          <div className="absolute top-20 left-60 w-28 h-28 border-2 border-red-600/20 rounded-lg rotate-45 pointer-events-none" />
          <div className="absolute -top-10 left-10 w-28 h-28 border-2 border-red-600/20 rounded-lg rotate-12 pointer-events-none" />
          <div className="absolute top-40 right-60 w-28 h-28 border-2 border-red-600/20 rounded-lg -rotate-12 pointer-events-none" />
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleCreateRoomClick}
            className="flex items-center gap-2 px-6 py-4 bg-red-600 hover:bg-[#b20710] text-white font-black text-xs uppercase tracking-widest rounded transition-all shadow-xl shadow-red-600/10 group"
          >
            <PlusIcon className="size-5" />
            Tạo phòng mới
          </button>
        </div>
      </div>

      {/* Options & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-6 mb-12 py-6 border-y border-white/5">
        <div className="flex flex-wrap items-center gap-3">
          <FilterPill label="Tất cả" active />
          <FilterPill label="Hành động" />
          <FilterPill label="Kinh dị" />
          <FilterPill label="Lãng mạn" />
          <FilterPill label="Âm nhạc" />
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-72">
            <MagnifyingGlassIcon className="size-5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Mã phòng, tên phim..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-full py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-zinc-600 focus:bg-zinc-800 transition"
            />
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefetching}
            className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-full hover:bg-zinc-800 hover:border-zinc-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            title="Làm mới danh sách"
          >
            <ArrowPathIcon
              className={`size-5 text-zinc-400 ${isRefetching ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="max-w-7xl mx-auto">
        {status === "pending" ? (
          <RoomCardSkeletons />
        ) : allRooms.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {allRooms.map((room: WatchPartyRoom) => (
                <RoomCard key={room.id} room={room} />
              ))}
            </div>

            {/* Phần tử mồi để kích hoạt fetchNextPage */}
            <div ref={ref} className="mt-6 w-full">
              {isFetchingNextPage && <RoomCardSkeletons />}
            </div>
          </>
        ) : (
          <div className="text-center py-20 bg-zinc-900/30 rounded-2xl border border-zinc-800/50">
            <span className="text-6xl mb-4 block">🍿</span>
            <h3 className="text-xl font-bold mb-2">Không tìm thấy phòng nào</h3>
            <p className="text-zinc-500">
              Hãy là người đầu tiên tạo phòng xem chung ngay hôm nay.
            </p>
          </div>
        )}
      </div>

      {showModal && <CreateRoomModal onClose={() => setShowModal(false)} />}
      <ConfirmModal
        isOpen={showKickedModal}
        isLoading={false}
        title="Bạn đã bị trục xuất khỏi phòng"
        description="Chủ phòng hoặc người quản lý đã mời bạn rời phòng xem chung. Bạn có thể tham gia phòng khác hoặc tạo phòng mới."
        confirmText="Đã hiểu"
        cancelText="Đóng"
        variant="primary"
        onClose={closeKickedModal}
        onConfirm={closeKickedModal}
      />
    </div>
  );
}

function FilterPill({
  label,
  active = false,
}: {
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
        active
          ? "bg-white text-black border-white"
          : "bg-transparent text-zinc-500 border-white/10 hover:border-white/30 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

const RoomCardSkeletons = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
    {[1, 2, 3, 4].map((n) => (
      <RoomCardSkeleton key={n} />
    ))}
  </div>
);
