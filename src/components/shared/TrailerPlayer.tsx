"use client";

import React from "react";
import { User } from "@supabase/supabase-js";
import { Movie } from "@/types";
import { useSubscriptionAction } from "@/hooks/useSubscription";
import { HeartIcon as HeartSolid } from "@heroicons/react/24/solid";
import { HeartIcon as HeartOutline } from "@heroicons/react/24/outline";

import { convertToEmbedUrl } from "@/lib/utils";

interface Props {
  movie: Movie;
  user?: User | null;
}

export default function TrailerPlayer({ movie, user }: Props) {
  // Hook xử lý Follow phim
  const { isFollowed, toggleFollow, isLoading } = useSubscriptionAction({
    user,
    movie,
  });

  // Kiểm tra có url trailer không
  const hasTrailer = movie.status === "trailer" && !!movie.trailer_url;

  return (
    <div
      id="video"
      className="space-y-6 scroll-mt-24 animate-in fade-in duration-700"
    >
      {/* KHU VỰC TRÌNH CHIẾU */}
      {hasTrailer ? (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white truncate">
            {`${movie.name} - Trailer Phim`}
          </h2>
          <div className="relative w-full aspect-video bg-black overflow-hidden rounded-2xl shadow-xl border border-white/10">
            <iframe
              src={convertToEmbedUrl(movie.trailer_url) || ""}
              title="Trailer"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          </div>
        </div>
      ) : (
        <div className="aspect-video bg-zinc-900/50 border border-zinc-800 rounded-2xl flex flex-col items-center justify-center text-center p-6 space-y-4">
          <div className="text-zinc-400 text-lg">
            Phim đang được cập nhật dữ liệu...
          </div>
        </div>
      )}

      {/* KHỐI ACTION: ĐĂNG KÝ NHẬN THÔNG BÁO */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
        <button
          onClick={toggleFollow}
          disabled={isLoading}
          className={`flex-shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition ${
            isFollowed
              ? "text-red-400 bg-red-400/10 hover:bg-red-400/20 border border-red-500/20"
              : "text-zinc-100 bg-zinc-800 hover:bg-zinc-700 border border-transparent"
          }`}
        >
          {isFollowed ? (
            <HeartSolid className="w-5 h-5" />
          ) : (
            <HeartOutline className="w-5 h-5" />
          )}
          <span>
            {isFollowed ? "Đã theo dõi" : "Nhận thông báo khi có phim"}
          </span>
        </button>

        <div className="text-sm text-zinc-400 leading-relaxed">
          <span className="text-yellow-500 font-semibold mr-1">
            Phim sắp ra mắt!
          </span>
          Hãy bấm theo dõi để hệ thống gửi thông báo ngay lập tức cho bạn khi bộ
          phim này cập nhật tập đầu tiên.
        </div>
      </div>
    </div>
  );
}
