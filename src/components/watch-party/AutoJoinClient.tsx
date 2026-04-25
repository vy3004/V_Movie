"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import NProgress from "nprogress";
import { toast } from "sonner";

export default function AutoJoinClient({ roomId }: { roomId: string }) {
  const router = useRouter();

  useEffect(() => {
    const joinRoom = async () => {
      const res = await fetch("/api/watch-party/join", {
        method: "POST",
        body: JSON.stringify({ roomId }),
      });
      if (res.ok)
        router.refresh(); // Refresh để Server chuyển màn hình
      else {
        toast.error("Không thể tham gia phòng");
        NProgress.start();
        router.push("/xem-chung");
      }
    };
    joinRoom();
  }, [roomId, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#141414] text-white">
      <span className="w-10 h-10 border-4 border-white/10 border-t-red-600 rounded-full animate-spin mb-4" />
      <p className="text-zinc-400 font-medium">Đang kết nối vào phòng...</p>
    </div>
  );
}
