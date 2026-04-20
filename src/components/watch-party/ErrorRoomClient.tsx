import { HomeIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

export default function ErrorRoomClient() {
  return (
    <div className="relative z-10 bg-[#0a0a0a] flex items-center justify-center p-6 sm:p-12 overflow-hidden min-h-[100vh]">
      {/* Dynamic Background Atmosphere */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-600/10 rounded-full blur-[150px] pointer-events-none" />

      <div className="relative z-10 max-w-md w-full text-center">
        {/* Error Details */}
        <div className="space-y-4 mb-12">
          <div className="flex flex-col items-center gap-4 mb-4">
            <span className="text-[10px] font-black text-red-600 uppercase tracking-[0.4em] bg-red-600/10 px-3 py-1 rounded-full">
              Lỗi kết nối
            </span>
            <h1 className="text-3xl font-black tracking-tighter uppercase italic text-white">
              Phòng đã bị đóng
            </h1>
          </div>
          <p className="text-zinc-500 text-sm leading-relaxed font-medium">
            Phòng này hiện không khả dụng. Có thể liên kết đã hết hạn hoặc chủ
            phòng đã đóng phòng.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/xem-chung"
            className="flex items-center justify-center gap-2 bg-white text-black p-4 rounded font-black uppercase text-xs tracking-widest hover:bg-zinc-200 transition-all active:scale-95 shadow-xl"
          >
            <UserGroupIcon className="size-5" /> Về sảnh xem chung
          </Link>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 bg-zinc-900 text-white p-4 rounded font-black uppercase text-xs tracking-widest border border-white/10 hover:bg-zinc-800 transition-all active:scale-95"
          >
            <HomeIcon className="size-5" /> Về trang chủ
          </Link>
        </div>
      </div>

      {/* Background Decorators */}
      <div className="absolute -bottom-20 -left-20 w-80 h-80 border border-white/[0.03] rounded-full pointer-events-none" />
      <div className="absolute top-10 right-10 w-24 h-24 border-2 border-red-600/5 rounded-lg rotate-45 pointer-events-none" />
    </div>
  );
}
