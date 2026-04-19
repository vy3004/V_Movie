"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useInView } from "react-intersection-observer";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  XMarkIcon,
  MagnifyingGlassIcon,
  LockClosedIcon,
  GlobeAltIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import ImageCustom from "@/components/ImageCustom";

import { useMovieSearch } from "@/hooks/useMovieSearch";
import { Movie } from "@/types";
import {
  CreateRoomFormValues,
  createRoomSchema,
} from "@/lib/validations/watch-party.validation";

export default function CreateRoomModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // 2. KHỞI TẠO REACT HOOK FORM
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateRoomFormValues>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: {
      title: "",
      isPrivate: false,
      maxParticipants: 10,
      movieSlug: "",
      movieName: "",
      movieImage: "",
      episodeSlug: "tap-1",
      settings: {
        wait_for_all: false,
        guest_can_chat: true,
        allow_guest_control: false,
      },
    },
  });

  // Watch các giá trị để render UI Custom (ví dụ slider, nút public/private)
  const isPrivate = watch("isPrivate");
  const maxParticipants = watch("maxParticipants");
  const titleVal = watch("title");

  // Hook tìm kiếm phim vô tận (Infinite Scroll)
  const {
    query,
    setQuery,
    isOpen,
    setIsOpen,
    handleSearchChange,
    movies,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMovieSearch(10);

  const { ref: loadMoreRef, inView } = useInView();

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Handle chọn phim
  const handleSelectMovie = (movie: Movie) => {
    // Đẩy giá trị vào form, ép re-validate để tắt lỗi nếu có
    setValue("movieSlug", movie.slug, { shouldValidate: true });
    setValue("movieName", movie.name);
    setValue("movieImage", movie.poster_url);

    setQuery(movie.name);
    setIsOpen(false);

    // Auto điền tên phòng nếu chưa có
    if (!titleVal) {
      setValue("title", `Cùng xem: ${movie.name}`, { shouldValidate: true });
    }
  };

  // 3. SUBMIT FORM
  const onSubmit = async (data: CreateRoomFormValues) => {
    setLoading(true);
    try {
      const res = await fetch("/api/watch-party", {
        method: "POST",
        body: JSON.stringify(data),
      });
      const result = await res.json();

      if (result.room) {
        toast.success("Tạo phòng thành công!");
        router.push(`/xem-chung/${result.room.room_code}`);
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      console.log(error);
      toast.error("Lỗi kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#18181b] border border-zinc-800 w-full max-w-lg rounded-2xl shadow-2xl relative flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-zinc-800 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              🍿 Tạo phòng xem chung
            </h2>
            <p className="text-sm text-zinc-400 mt-1">
              Cùng bạn bè trải nghiệm phim yêu thích
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition bg-zinc-900 rounded-full p-2"
          >
            <XMarkIcon className="size-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <form
            id="create-room-form"
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-6"
          >
            {/* 1. Chọn Phim (Custom Input) */}
            <div className="relative z-50">
              <label className="block text-sm font-bold text-zinc-300 mb-2">
                Bộ phim muốn xem *
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute size-6 left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={query}
                  onChange={handleSearchChange}
                  onClick={() => query.trim() && setIsOpen(true)}
                  placeholder="Nhập tên phim để tìm kiếm..."
                  className={`w-full bg-zinc-900 border text-white rounded-xl py-3.5 pl-10 pr-4 focus:outline-none transition shadow-inner ${
                    errors.movieSlug
                      ? "border-red-500"
                      : "border-zinc-700 focus:border-red-600"
                  }`}
                />
              </div>
              {/* Hiển thị lỗi Zod của việc thiếu phim */}
              {errors.movieSlug && (
                <p className="text-red-500 text-xs mt-1.5 font-medium">
                  {errors.movieSlug.message}
                </p>
              )}

              {/* Dropdown Kết quả */}
              {isOpen && query && (
                <div className="absolute top-full left-0 w-full mt-2 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
                  {isFetching && !isFetchingNextPage && movies.length === 0 ? (
                    <div className="p-4 text-center text-sm text-zinc-400 animate-pulse">
                      Đang tìm kiếm phim...
                    </div>
                  ) : movies.length > 0 ? (
                    <div className="max-h-64 overflow-y-auto custom-scrollbar">
                      {movies.map((movie) => (
                        <div
                          key={movie._id}
                          onClick={() => handleSelectMovie(movie)}
                          className="flex items-center gap-3 p-3 hover:bg-zinc-700 cursor-pointer transition border-b border-zinc-700/50 last:border-0"
                        >
                          <ImageCustom
                            src={movie.thumb_url}
                            alt={movie.name}
                            widths={[60]}
                            className="w-10 h-14 object-cover rounded-md shadow-md"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-white font-bold text-sm truncate">
                              {movie.name}
                            </h4>
                            <p className="text-xs text-zinc-400 truncate">
                              {movie.origin_name} • {movie.year}
                            </p>
                          </div>
                        </div>
                      ))}
                      {isFetchingNextPage && (
                        <div className="p-3 text-center text-xs text-zinc-400 animate-pulse">
                          Đang tải thêm phim...
                        </div>
                      )}
                      {hasNextPage && <div ref={loadMoreRef} className="h-4" />}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-sm text-zinc-400">
                      Không tìm thấy phim nào
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. Tên phòng */}
            <div>
              <label className="block text-sm font-bold text-zinc-300 mb-2">
                Tên phòng chiếu
              </label>
              <input
                {...register("title")}
                placeholder="VD: Cày phim đêm khuya..."
                className={`w-full bg-zinc-900 border text-white rounded-xl px-4 py-3.5 focus:outline-none transition shadow-inner ${
                  errors.title
                    ? "border-red-500"
                    : "border-zinc-700 focus:border-red-600"
                }`}
              />
              {errors.title && (
                <p className="text-red-500 text-xs mt-1.5 font-medium">
                  {errors.title.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* 3. Chế độ (Public/Private) */}
              <div>
                <label className="block text-sm font-bold text-zinc-300 mb-2">
                  Quyền riêng tư
                </label>
                <div className="flex bg-zinc-900 rounded-xl border border-zinc-800 p-1">
                  <button
                    type="button"
                    onClick={() => setValue("isPrivate", false)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition ${
                      !isPrivate
                        ? "bg-zinc-700 text-white shadow-md"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <GlobeAltIcon className="size-5" /> Public
                  </button>
                  <button
                    type="button"
                    onClick={() => setValue("isPrivate", true)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition ${
                      isPrivate
                        ? "bg-red-600 text-white shadow-md"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <LockClosedIcon className="size-5" /> Private
                  </button>
                </div>
              </div>

              {/* 4. Số lượng thành viên */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-bold text-zinc-300">
                    Giới hạn người
                  </label>
                  <span className="text-red-500 font-bold text-xs bg-red-500/10 px-2 py-1 rounded-md">
                    {maxParticipants} / 20
                  </span>
                </div>
                <div className="flex items-center h-[42px] px-2 bg-zinc-900 rounded-xl border border-zinc-800">
                  <input
                    type="range"
                    min="2"
                    max="20"
                    {...register("maxParticipants", { valueAsNumber: true })}
                    className="w-full accent-red-600 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* 5. Cài đặt nâng cao */}
            <div className="pt-2 border-t border-zinc-800/80">
              <h3 className="text-sm font-bold text-zinc-400 mb-4 flex items-center gap-2">
                <Cog6ToothIcon className="size-5" /> Tùy chọn nâng cao
              </h3>

              <div className="space-y-3">
                <label className="flex items-center justify-between cursor-pointer group">
                  <div className="text-sm text-zinc-300 group-hover:text-white transition">
                    Đợi tất cả tải xong (Chống lag)
                  </div>
                  <input
                    type="checkbox"
                    {...register("settings.wait_for_all")}
                    className="w-4 h-4 accent-red-600"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer group">
                  <div className="text-sm text-zinc-300 group-hover:text-white transition">
                    Khách được phép chat
                  </div>
                  <input
                    type="checkbox"
                    {...register("settings.guest_can_chat")}
                    className="w-4 h-4 accent-red-600"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer group">
                  <div className="text-sm text-zinc-300 group-hover:text-white transition">
                    Khách được phép tua/dừng phim
                  </div>
                  <input
                    type="checkbox"
                    {...register("settings.allow_guest_control")}
                    className="w-4 h-4 accent-red-600"
                  />
                </label>
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-800 bg-zinc-900/50 shrink-0 rounded-b-2xl">
          <button
            type="submit"
            form="create-room-form"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl transition disabled:opacity-50 disabled:hover:bg-red-600 flex justify-center items-center gap-2 shadow-lg shadow-red-600/20"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "🍿 Mở phòng ngay"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
