"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import NProgress from "nprogress";
import { toast } from "sonner";
import { LockClosedIcon, GlobeAltIcon } from "@heroicons/react/24/outline";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useWatchParty } from "@/providers/WatchPartyProvider";
import { WatchPartyRoom, RoomSettings } from "@/types";

export default function SettingsTab() {
  const router = useRouter();
  const { room, setRoom } = useWatchParty(); //

  const [isEndModalOpen, setIsEndModalOpen] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  // Hàm cập nhật cài đặt (Optimistic UI)
  const updateSetting = async (
    key: keyof WatchPartyRoom | keyof RoomSettings,
    value: string | boolean,
    isRoot = false,
  ) => {
    if (!room) return;
    const prevRoom = { ...room };

    // Cập nhật giao diện ngay lập tức
    const newRoom = isRoot
      ? { ...room, [key]: value }
      : { ...room, settings: { ...room.settings, [key]: value } };

    setRoom(newRoom as WatchPartyRoom);

    try {
      const payload = isRoot
        ? { [key]: value }
        : { settings: newRoom.settings };

      const res = await fetch("/api/watch-party/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id, ...payload }),
      });

      if (!res.ok) throw new Error();
    } catch {
      setRoom(prevRoom); // Rollback nếu lỗi RLS
      toast.error("Không có quyền thay đổi cài đặt");
    }
  };

  // Kích hoạt ngòi nổ: Ẩn phòng và báo hiệu kết thúc
  const handleEndSession = async () => {
    if (!room) return;
    setIsEnding(true);

    try {
      const res = await fetch("/api/watch-party/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id, is_active: false }),
      });

      if (!res.ok) throw new Error();

      toast.success("Phiên xem chung đang được kết thúc...");
      setIsEndModalOpen(false);

      // Host rời đi trước, Trigger SQL sẽ dọn dẹp khi Member cũng văng ra
      NProgress.start();
      router.push("/xem-chung");
    } catch {
      toast.error("Lỗi khi đóng phòng");
    } finally {
      setIsEnding(false);
    }
  };

  const settingOptions: { label: string; key: keyof RoomSettings }[] = [
    { label: "Đợi tất cả tải xong (Chống lag)", key: "wait_for_all" },
    { label: "Khách được phép chat", key: "guest_can_chat" },
    { label: "Khách được phép điều khiển Video", key: "allow_guest_control" },
  ];

  if (!room) return null;

  return (
    <div className="space-y-6 h-full overflow-y-auto pr-2 custom-scrollbar pb-20">
      {/* 1. THÔNG TIN PHÒNG */}
      <div>
        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3 block">
          Cấu hình phòng
        </label>
        <div className="space-y-4">
          <div>
            <span className="text-xs text-zinc-400 mb-1 block">Tên phòng</span>
            <input
              defaultValue={room.title}
              onBlur={(e) => {
                if (
                  e.target.value.trim() !== "" &&
                  e.target.value !== room.title
                )
                  updateSetting("title", e.target.value, true);
              }}
              className="w-full bg-zinc-950 rounded-xl px-4 py-3 text-sm border border-zinc-800 focus:border-red-600 transition text-white outline-none"
            />
          </div>

          <div>
            <span className="text-xs text-zinc-400 mb-1 block">Hiển thị</span>
            <div className="flex bg-zinc-950 rounded-xl border border-zinc-800 p-1">
              <button
                onClick={() => updateSetting("is_private", false, true)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition ${!room.is_private ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500"}`}
              >
                <GlobeAltIcon className="w-4 h-4" /> Công khai
              </button>
              <button
                onClick={() => updateSetting("is_private", true, true)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition ${room.is_private ? "bg-red-600 text-white shadow-sm" : "text-zinc-500"}`}
              >
                <LockClosedIcon className="w-4 h-4" /> Riêng tư
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. QUYỀN HẠN MẶC ĐỊNH */}
      <div>
        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3 block">
          Quyền hạn mặc định
        </label>
        <div className="space-y-2">
          {settingOptions.map((s) => (
            <label
              key={s.key}
              className="flex items-center justify-between p-3 bg-zinc-800/30 rounded-xl cursor-pointer hover:bg-zinc-800/50 border border-transparent hover:border-zinc-700 transition"
            >
              <span className="text-xs text-zinc-300 font-medium">
                {s.label}
              </span>
              <div
                className={`w-8 h-4 rounded-full relative transition-colors ${room.settings?.[s.key] ? "bg-emerald-500" : "bg-zinc-700"}`}
              >
                <div
                  className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${room.settings?.[s.key] ? "translate-x-[18px]" : "translate-x-0.5"}`}
                />
              </div>
              <input
                type="checkbox"
                className="hidden"
                checked={room.settings?.[s.key] || false}
                onChange={(e) => updateSetting(s.key, e.target.checked)}
              />
            </label>
          ))}
        </div>
      </div>

      {/* 3. NÚT KẾT THÚC */}
      <div className="pt-4 border-t border-zinc-800">
        <button
          onClick={() => setIsEndModalOpen(true)}
          className="w-full py-3 bg-red-500/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/20 rounded-xl text-sm font-bold transition shadow-lg"
        >
          Kết thúc phòng xem chung
        </button>
      </div>

      <ConfirmModal
        isOpen={isEndModalOpen}
        isLoading={isEnding}
        title="Kết thúc phòng?"
        description="Phòng sẽ bị đóng và mọi người sẽ được thông báo. Bạn có chắc không?"
        confirmText="Kết thúc"
        onClose={() => setIsEndModalOpen(false)}
        onConfirm={handleEndSession}
      />
    </div>
  );
}
