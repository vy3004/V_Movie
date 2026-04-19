"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import {
  ClockIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import ImageCustom from "@/components/ImageCustom";
import { User, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createSupabaseClient } from "@/lib/supabase/client";
import { WatchPartyRoom, WatchPartyParticipant } from "@/types";

interface WaitingRoomClientProps {
  room: WatchPartyRoom;
  user: User;
  me: WatchPartyParticipant | null;
}

export default function WaitingRoomClient({
  room,
  me,
}: WaitingRoomClientProps) {
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseClient());

  const { data: approvedCount = 0, refetch: refetchCount } = useQuery({
    queryKey: ["wp-approved-count", room.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("watch_party_participants")
        .select("*", { count: "exact", head: true })
        .eq("room_id", room.id)
        .eq("status", "approved");
      return count || 0;
    },
  });

  const isFull = approvedCount >= room.max_participants;

  useEffect(() => {
    if (!me?.id) return;

    const channel = supabase
      .channel(`waiting_room_${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "watch_party_participants",
          filter: `room_id=eq.${room.id}`,
        },
        (payload: RealtimePostgresChangesPayload<WatchPartyParticipant>) => {
          refetchCount();

          const eventType = payload.eventType;

          // Xử lý khi Host bấm DUYỆT (UPDATE)
          if (eventType === "UPDATE") {
            if (
              payload.new?.id === me.id &&
              payload.new?.status === "approved"
            ) {
              toast.success("Host đã duyệt! Đang vào phòng...", { icon: "🎉" });
              window.location.reload();
            }
          }

          // Xử lý khi Host bấm TỪ CHỐI (DELETE)
          if (eventType === "DELETE") {
            if (payload.old?.id === me.id) {
              toast.error("Yêu cầu tham gia của bạn đã bị từ chối.");
              router.replace("/xem-chung");
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room.id, me?.id, router, refetchCount, supabase]);

  useEffect(() => {
    if (isFull) {
      toast.info(
        "Phòng hiện đã đầy, bạn vui lòng đợi có người rời phòng nhé!",
        {
          id: "waiting-room-full",
          duration: 5000,
        },
      );
    }
  }, [isFull]);

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-[#141414]">
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

      <div className="relative z-10 text-center space-y-6">
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto animate-pulse shadow-2xl transition-colors ${
            isFull
              ? "bg-amber-500/20 shadow-amber-500/10"
              : "bg-zinc-800/50 shadow-white/10"
          }`}
        >
          {isFull ? (
            <ExclamationTriangleIcon className="w-10 h-10 text-amber-500" />
          ) : (
            <ClockIcon className="w-10 h-10 text-zinc-400" />
          )}
        </div>

        <div className="max-w-sm mx-auto">
          <h1 className="text-2xl font-bold text-white mb-2">
            {isFull ? "Phòng hiện đã đầy" : "Đang đợi phê duyệt..."}
          </h1>
          <p className="text-zinc-400 text-sm">
            {isFull
              ? `Phòng đã đạt giới hạn ${room.max_participants} người. Bạn sẽ được duyệt ngay khi có thành viên khác rời phòng.`
              : `Host đã nhận được yêu cầu của bạn. Vui lòng đợi trong giây lát, cửa sẽ tự động mở nếu được chấp nhận.`}
          </p>

          <div className="mt-6 inline-flex items-center gap-2 px-3 py-1 bg-zinc-800/80 rounded-full border border-zinc-700">
            <span className="text-[10px] font-bold text-zinc-500 uppercase">
              Sĩ số:
            </span>
            <span
              className={`text-xs font-black ${isFull ? "text-amber-500" : "text-emerald-500"}`}
            >
              {approvedCount} / {room.max_participants}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
