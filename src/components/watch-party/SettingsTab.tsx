"use client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { LockClosedIcon, GlobeAltIcon } from "@heroicons/react/24/outline";

export default function SettingsTab({ room, setRoom }: any) {
  const router = useRouter();

  // Optimistic UI Update
  const updateSetting = async (key: string, value: any, isRoot = false) => {
    // 1. Lưu state cũ để backup
    const prevRoom = { ...room };

    // 2. Cập nhật state UI ngay lập tức
    const newRoom = isRoot
      ? { ...room, [key]: value }
      : { ...room, settings: { ...room.settings, [key]: value } };
    setRoom(newRoom);

    // 3. Gọi API chạy ngầm
    const payload = isRoot ? { [key]: value } : { settings: newRoom.settings };
    const res = await fetch("/api/watch-party/settings", {
      method: "PATCH",
      body: JSON.stringify({ roomId: room.id, ...payload }),
    });

    if (!res.ok) {
      // 4. Nếu API lỗi, revert lại state cũ
      setRoom(prevRoom);
      toast.error("Lỗi khi lưu cài đặt!");
    }
  };

  const endSession = async () => {
    if (
      !confirm(
        "Bạn có chắc muốn kết thúc phòng xem chung này? Tất cả thành viên sẽ bị đẩy ra ngoài.",
      )
    )
      return;
    await fetch("/api/watch-party/settings", {
      method: "PATCH",
      body: JSON.stringify({ roomId: room.id, is_active: false }),
    });
    router.push("/xem-chung");
  };

  return (
    <div className="space-y-6 h-full overflow-y-auto pr-2 custom-scrollbar pb-20">
      <div>
        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3 block">
          Thông tin phòng
        </label>
        <div className="space-y-4">
          <div>
            <span className="text-xs text-zinc-400 mb-1 block">Tên phòng</span>
            <input
              defaultValue={room.title}
              onBlur={(e) => {
                if (e.target.value !== room.title)
                  updateSetting("title", e.target.value, true);
              }}
              className="w-full bg-zinc-950 rounded-xl px-4 py-3 text-sm focus:outline-none border border-zinc-800 focus:border-red-600 transition"
            />
          </div>

          <div>
            <span className="text-xs text-zinc-400 mb-1 block">Trạng thái</span>
            <div className="flex bg-zinc-950 rounded-xl border border-zinc-800 p-1">
              <button
                type="button"
                onClick={() => updateSetting("is_private", false, true)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition ${!room.is_private ? "bg-zinc-800 text-white" : "text-zinc-500"}`}
              >
                <GlobeAltIcon className="w-4 h-4" /> Public
              </button>
              <button
                type="button"
                onClick={() => updateSetting("is_private", true, true)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition ${room.is_private ? "bg-red-600 text-white" : "text-zinc-500"}`}
              >
                <LockClosedIcon className="w-4 h-4" /> Private
              </button>
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3 block">
          Quyền Mặc định (Cho người mới)
        </label>
        <div className="space-y-2">
          {[
            { label: "Đợi tất cả tải xong (Chống lag)", key: "wait_for_all" },
            { label: "Khách được phép chat", key: "guest_can_chat" },
            {
              label: "Khách được phép điều khiển Video",
              key: "allow_guest_control",
            },
          ].map((s) => (
            <label
              key={s.key}
              className="flex items-center justify-between p-3 bg-zinc-800/30 rounded-xl cursor-pointer hover:bg-zinc-800/50 transition border border-transparent hover:border-zinc-700"
            >
              <span className="text-xs text-zinc-300 font-medium">
                {s.label}
              </span>
              {/* Toggle UI */}
              <div
                className={`w-8 h-4 rounded-full relative transition-colors ${room.settings[s.key] ? "bg-emerald-500" : "bg-zinc-900"}`}
              >
                <div
                  className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${room.settings[s.key] ? "left-4.5 translate-x-4" : "left-0.5"}`}
                />
              </div>
              <input
                type="checkbox"
                className="hidden"
                checked={room.settings[s.key]}
                onChange={(e) => updateSetting(s.key, e.target.checked)}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-zinc-800">
        <button
          onClick={endSession}
          className="w-full py-3 bg-red-500/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/20 rounded-xl text-sm font-bold transition"
        >
          Kết thúc phòng xem chung
        </button>
      </div>
    </div>
  );
}
