import { createSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LockClosedIcon } from "@heroicons/react/24/outline";

import KnockDoorClient from "@/components/watch-party/KnockDoorClient";
import AutoJoinClient from "@/components/watch-party/AutoJoinClient";
import WatchPartyClient from "@/components/watch-party/WatchPartyClient";
import WaitingRoomClient from "@/components/watch-party/WaitingRoomClient";
import ErrorRoomClient from "@/components/watch-party/ErrorRoomClient";

export default async function WatchPartyPage({
  params,
}: {
  params: { code: string };
}) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/dang-nhap?next=/xem-chung/${params.code}`);
  }

  // 1. Fetch thông tin phòng
  const { data: room } = await supabase
    .from("watch_party_rooms")
    .select("*, host:profiles!host_id(full_name, avatar_url)")
    .eq("room_code", params.code.toUpperCase())
    .maybeSingle();

  if (!room || !room.is_active) {
    return <ErrorRoomClient />;
  }

  // 2. Fetch trạng thái của User hiện tại
  const { data: participant } = await supabase
    .from("watch_party_participants")
    .select("*")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .single();

  // 3. LOGIC PHÂN LUỒNG MÀN HÌNH
  if (participant) {
    if (participant.status === "approved") {
      // Đã được duyệt -> Render UI phòng xem phim chính
      return <WatchPartyClient room={room} user={user} me={participant} />;
    }
    if (participant.status === "pending") {
      return <WaitingRoomClient room={room} user={user} me={participant} />;
    }
    if (participant.status === "blocked") {
      // Bị Kick/Từ chối -> Màn hình cấm
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#141414] text-white">
          <div className="text-center space-y-4 bg-zinc-900 p-8 rounded-3xl border border-red-500/20">
            <LockClosedIcon className="w-16 h-16 text-red-500 mx-auto" />
            <h1 className="text-2xl font-bold">Bạn đã bị chặn</h1>
            <p className="text-zinc-400">
              Bạn không thể tham gia lại phòng chiếu này.
            </p>
          </div>
        </div>
      );
    }
  }

  // 4. Nếu chưa có record (Chưa join lần nào)
  if (!room.is_private) {
    return <AutoJoinClient roomId={room.id} />; // Tự động join và vào luôn
  }

  return <KnockDoorClient room={room} />; // Phòng Private -> Phải bấm nút Gõ Cửa
}
