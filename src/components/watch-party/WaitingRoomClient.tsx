"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { ClockIcon } from "@heroicons/react/24/outline";

export default function WaitingRoomClient({
  room,
  user,
}: {
  room: any;
  user: any;
}) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseClient();

    // Lắng nghe sự thay đổi của Postgres trên bảng participants, bắt đúng userId của mình
    const channel = supabase
      .channel("waiting_room")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "watch_party_participants",
          filter: `room_id=eq.${room.id}&user_id=eq.${user.id}`,
        },
        (payload) => {
          if (
            payload.new.status === "approved" ||
            payload.new.status === "blocked"
          ) {
            // Host vừa bấm Duyệt hoặc Từ chối -> F5 ngầm để đổi UI
            router.refresh();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room.id, user.id, router]);

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-[#141414]">
      <div className="absolute inset-0 z-0">
        <img
          src={room.movie_image}
          alt=""
          className="w-full h-full object-cover opacity-20 blur-2xl"
        />
        <div className="absolute inset-0 bg-black/80" />
      </div>

      <div className="relative z-10 text-center space-y-6">
        <div className="w-20 h-20 bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto animate-pulse shadow-[0_0_40px_rgba(255,255,255,0.1)]">
          <ClockIcon className="w-10 h-10 text-zinc-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Đang đợi phê duyệt...
          </h1>
          <p className="text-zinc-400 max-w-sm mx-auto text-sm">
            Host đã nhận được yêu cầu của bạn. Vui lòng đợi trong giây lát, cửa
            sẽ tự động mở nếu được chấp nhận.
          </p>
        </div>
      </div>
    </div>
  );
}
