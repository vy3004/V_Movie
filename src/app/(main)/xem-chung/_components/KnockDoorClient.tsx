"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LockClosedIcon } from "@heroicons/react/24/outline";
import ImageCustom from "@/components/ui/ImageCustom";
import { WatchPartyRoom } from "@/types";

export default function KnockDoorClient({ room }: { room: WatchPartyRoom }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleKnock = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/watch-party/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id }),
      });

      if (res.ok) {
        router.refresh(); // Sẽ tự động nhảy sang Sảnh Chờ (Waiting Room)
      } else {
        toast.error("Có lỗi xảy ra, thử lại sau");
      }
    } catch {
      toast.error("Lỗi kết nối, vui lòng thử lại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-[#141414]">
      {/* Background Blur */}
      <div className="absolute inset-0 z-0">
        {room.movie_image && (
          <ImageCustom
            className="w-full h-full object-cover opacity-50 blur-2xl"
            src={room.movie_image}
            alt={room.title || "Waiting Room"}
            widths={[10]}
          />
        )}
        <div className="absolute inset-0 bg-black/20" />
      </div>

      <div className="relative z-10 w-full max-w-md bg-zinc-900/80 backdrop-blur-xl p-8 rounded-3xl border border-zinc-800 text-center shadow-2xl">
        <div className="w-16 h-16 bg-red-600/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <LockClosedIcon className="w-8 h-8 text-red-500" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">{room.title}</h1>
        <p className="text-zinc-400 mb-6 text-sm">
          Phòng chiếu phim này là riêng tư. Bạn cần được Host{" "}
          <b>{room.host?.full_name || "chủ phòng"}</b> phê duyệt để tham gia.
        </p>
        <button
          onClick={handleKnock}
          disabled={loading}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl transition disabled:opacity-50 flex justify-center items-center"
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            "🚪 Gõ cửa xin vào"
          )}
        </button>
      </div>
    </div>
  );
}
