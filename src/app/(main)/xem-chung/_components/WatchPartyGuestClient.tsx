"use client";

import { useEffect, useRef } from "react";
import { LockClosedIcon } from "@heroicons/react/24/outline";
import UserAvatar from "@/components/shared/UserAvatar";
import { useAuthModal } from "@/providers/AuthModalProvider";
import { WatchPartyRoom } from "@/types";
import { useData } from "@/providers/BaseDataContextProvider";
import { useRouter } from "next/navigation";

export default function WatchPartyGuestClient({
  room,
}: {
  room: WatchPartyRoom;
}) {
  const { onOpen: openLogin } = useAuthModal();
  const { user } = useData();
  const router = useRouter();
  const wasLoggedIn = useRef(!!user);

  useEffect(() => {
    if (user && !wasLoggedIn.current) {
      router.refresh();
    }
    wasLoggedIn.current = !!user;
  }, [user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#141414] text-white p-6">
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-10 rounded-[2.5rem] text-center space-y-6 shadow-2xl">
        <div className="relative inline-block">
          <UserAvatar
            avatar_url={room.host?.avatar_url}
            user_name={room.host?.full_name || "Host"}
            size={80}
          />
          <div className="absolute -bottom-1 -right-1 bg-red-600 p-1.5 rounded-full border-4 border-zinc-900">
            <LockClosedIcon className="w-4 h-4 text-white" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-black uppercase italic tracking-tighter">
            DỪNG LẠI MỘT CHÚT!
          </h2>
          <p className="text-zinc-400 text-sm">
            Bạn đang cố gắng tham gia phòng của{" "}
            <span className="text-white font-bold">
              {room.host?.full_name || "Host"}
            </span>
            . Vui lòng đăng nhập để xem chung cùng mọi người nhé!
          </p>
        </div>

        <button
          onClick={openLogin}
          className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-red-600/20 uppercase tracking-widest text-xs"
        >
          Đăng nhập ngay
        </button>
      </div>
    </div>
  );
}
