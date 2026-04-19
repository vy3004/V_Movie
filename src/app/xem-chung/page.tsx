"use client";

import { useState, useRef, useEffect } from "react";
import { MagnifyingGlassIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useQuery } from "@tanstack/react-query";
import { debounce } from "lodash-es"; // <--- Import từ lodash-es
import RoomCard from "@/components/watch-party/RoomCard";
import CreateRoomModal from "@/components/watch-party/CreateRoomModal";
import { WatchPartyRoom } from "@/types";

export default function WatchPartyLobbyPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [querySearch, setQuerySearch] = useState(""); // State thực sự dùng để gọi API
  const [showModal, setShowModal] = useState(false);

  // 1. Tạo hàm debounce bằng lodash-es và giữ nó không bị re-create bằng useRef
  const debouncedSearch = useRef(
    debounce((value: string) => {
      setQuerySearch(value);
    }, 500),
  ).current;

  // 2. Dọn dẹp (cancel) debounce khi component bị unmount để tránh rò rỉ bộ nhớ
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value); // Cập nhật text trên input ngay lập tức
    debouncedSearch(value); // Delay 500ms rồi mới cập nhật querySearch để gọi API
  };

  const { data, isLoading } = useQuery({
    queryKey: ["wp-lobby", querySearch], // Dùng querySearch đã được debounce
    queryFn: async () => {
      const res = await fetch(`/api/watch-party/lobby?search=${querySearch}`);
      return res.json();
    },
  });

  const rooms = data?.rooms || [];

  return (
    <div className="min-h-screen bg-[#141414] text-white pt-24 pb-20 px-6 lg:px-12">
      {/* Header Section */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 mb-12">
        <div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-2">
            Xem chung <span className="text-red-600">Cùng bạn bè</span>
          </h1>
          <p className="text-zinc-400 text-sm md:text-base">
            Trải nghiệm rạp chiếu phim tại nhà. Vừa xem vừa chém gió.
          </p>
        </div>

        <div className="flex w-full md:w-auto items-center gap-4">
          <div className="relative w-full md:w-72">
            <MagnifyingGlassIcon className="size-5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Mã phòng, tên phim..."
              value={searchTerm}
              onChange={handleSearchChange} // <--- Sử dụng hàm change mới
              className="w-full bg-zinc-900 border border-zinc-800 rounded-full py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-zinc-600 focus:bg-zinc-800 transition"
            />
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex-shrink-0 flex items-center gap-2 bg-white text-black hover:bg-zinc-200 px-5 py-2.5 rounded-full font-semibold transition"
          >
            <PlusIcon className="size-5" />{" "}
            <span className="hidden sm:inline">Tạo phòng</span>
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="max-w-7xl mx-auto">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <div
                key={n}
                className="aspect-video bg-zinc-900 animate-pulse rounded-xl"
              />
            ))}
          </div>
        ) : rooms.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {rooms.map((room: WatchPartyRoom) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
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
    </div>
  );
}
