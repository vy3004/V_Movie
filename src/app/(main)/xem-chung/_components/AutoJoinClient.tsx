"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import NProgress from "nprogress";
import { toast } from "sonner";

export default function AutoJoinClient({ roomId }: { roomId: string }) {
  const router = useRouter();

  useEffect(() => {
    // 1. Tạo "công tắc hủy" request
    const controller = new AbortController();

    const joinRoom = async () => {
      try {
        const res = await fetch("/api/watch-party/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId }),
          signal: controller.signal, // Gắn công tắc vào fetch
        });

        if (res.ok) {
          router.refresh(); // Refresh để Server chuyển màn hình
        } else {
          toast.error("Không thể tham gia phòng");
          NProgress.start();
          router.push("/xem-chung");
        }
      } catch (error) {
        // 2. Nếu lỗi là do bị Abort (người dùng thoát ra) thì bỏ qua, không báo lỗi
        if (error instanceof Error && error.name === "AbortError") return;

        // 3. Nếu là lỗi rớt mạng thực sự thì văng ra đây
        toast.error("Lỗi kết nối mạng, vui lòng thử lại!");
        NProgress.start();
        router.push("/xem-chung");
      }
    };

    joinRoom();

    // 4. Cleanup: Tự động hủy request nếu Component bị Unmount
    return () => {
      controller.abort();
    };
  }, [roomId, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#141414] text-white">
      <span className="w-10 h-10 border-4 border-white/10 border-t-red-600 rounded-full animate-spin mb-4" />
      <p className="text-zinc-400 font-medium">Đang kết nối vào phòng...</p>
    </div>
  );
}
