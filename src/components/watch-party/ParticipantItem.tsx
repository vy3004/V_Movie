import React from "react";
import {
  VideoCameraIcon,
  ShieldCheckIcon,
  XMarkIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/24/outline";
import ImageCustom from "@/components/ImageCustom";
import { UserPresence, WatchPartyParticipant } from "@/types/watch-party";

// ----------------------------------------------------------------------
// 1. ĐỊNH NGHĨA TYPES
// ----------------------------------------------------------------------

interface ParticipantItemProps {
  participant: WatchPartyParticipant;
  presence?: UserPresence;
  isRealHost: boolean; // Chỉ Host thật mới có quyền phong tước
  canManageUsers: boolean; // Mod & Host đều có thể mở Menu để Kick
  isMe: boolean;
  onTogglePermission: (
    userId: string,
    key: keyof WatchPartyParticipant["permissions"],
  ) => void;
  onKick: (userId: string) => void;
  isOpenMenu: boolean;
  setOpenMenu: (id: string | null) => void;
}

interface PermissionToggleProps {
  label: string;
  icon: React.ReactNode;
  enabled: boolean;
  onClick: () => void;
}

// ----------------------------------------------------------------------
// 2. COMPONENT CHÍNH
// ----------------------------------------------------------------------

export default function ParticipantItem({
  participant,
  presence,
  isRealHost,
  canManageUsers,
  isMe,
  onTogglePermission,
  onKick,
  isOpenMenu,
  setOpenMenu,
}: ParticipantItemProps) {
  // --- TÍNH TOÁN TRẠNG THÁI HIỂN THỊ ---
  const isOnline = !!presence;
  const isAway = presence?.status === "away";

  const statusColor = !isOnline
    ? "bg-zinc-600"
    : isAway
      ? "bg-yellow-500"
      : "bg-emerald-500";

  // --- ĐIỀU KIỆN BẢO MẬT HIỂN THỊ MENU ---
  // 1. Phải có quyền quản lý (Mod hoặc Host)
  // 2. Không được tự mở menu cho chính mình (để tránh tự kick)
  // 3. Người bị bấm KHÔNG PHẢI LÀ HOST (Luật bất thành văn: Không ai đụng được Host)
  const canShowMenu = canManageUsers && !isMe && participant.role !== "host";

  // Bảo vệ an toàn: Ngay cả khi hiển thị menu, Mod cũng không thể thấy nút Toggle Quyền
  const permissions = participant.permissions || {
    can_manage_users: false,
    can_control_media: false,
  };

  return (
    <div className="group flex items-center gap-3 p-3 hover:bg-zinc-800/40 rounded-2xl transition border border-transparent hover:border-zinc-800 relative">
      {/* --- CỘT 1: AVATAR & TRẠNG THÁI ONLINE --- */}
      <div className="relative shrink-0">
        <ImageCustom
          className="w-10 h-10 rounded-full border-2 border-zinc-800 object-cover shadow-md"
          src={participant.profiles?.avatar_url || "/default-avatar.png"}
          alt={`${participant.profiles?.full_name}'s avatar`}
          widths={[60]}
        />
        <div
          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${statusColor} border-[3px] border-[#18181b] rounded-full`}
          title={!isOnline ? "Offline" : isAway ? "Away" : "Online"}
        />
      </div>

      {/* --- CỘT 2: THÔNG TIN (TÊN & CÁC TAG QUYỀN HẠN) --- */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p
            className={`text-sm font-bold truncate ${
              participant.role === "host" ? "text-red-500" : "text-zinc-200"
            }`}
          >
            {participant.profiles?.full_name}
          </p>
          {isMe && (
            <span className="bg-white/10 text-white text-[9px] px-1.5 py-0.5 rounded font-black uppercase">
              Bạn
            </span>
          )}
        </div>

        {/* Khu vực hiển thị Tags */}
        <div className="flex flex-wrap gap-1.5 mt-1">
          {/* Tag MOD */}
          {permissions.can_manage_users && (
            <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 font-black tracking-widest uppercase flex items-center gap-1">
              Mod
            </span>
          )}

          {/* Tag REMOTE */}
          {permissions.can_control_media && (
            <span className="text-[8px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20 font-black tracking-widest uppercase flex items-center gap-1">
              Remote
            </span>
          )}

          {/* Tag KHÁCH (Nếu không có quyền gì) */}
          {!permissions.can_manage_users &&
            !permissions.can_control_media &&
            participant.role !== "host" && (
              <span className="text-[9px] text-zinc-600 font-medium italic">
                Thành viên
              </span>
            )}
        </div>
      </div>

      {/* --- CỘT 3: NÚT 3 CHẤM (THAO TÁC QUẢN LÝ) --- */}
      {canShowMenu && (
        <div className="relative">
          <button
            onClick={() => setOpenMenu(isOpenMenu ? null : participant.id)}
            className="p-2 text-zinc-500 hover:text-white rounded-xl transition outline-none"
            aria-label={`Quản lý ${participant.profiles?.full_name}`}
          >
            <EllipsisVerticalIcon className="w-5 h-5" />
          </button>

          {/* DROPDOWN MENU */}
          {isOpenMenu && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-[100] p-3 space-y-4 animate-in fade-in zoom-in-95 origin-top-right border-t-red-600/50 border-t-2">
              {/* KHU VỰC PHONG TƯỚC (CHỈ HOST MỚI THẤY) */}
              {isRealHost && (
                <>
                  <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest px-1">
                    Cấp quyền nhanh
                  </p>

                  <PermissionToggle
                    label="Quản trị viên"
                    icon={
                      <ShieldCheckIcon className="w-4 h-4 text-emerald-400" />
                    }
                    enabled={permissions.can_manage_users}
                    onClick={() =>
                      onTogglePermission(
                        participant.user_id,
                        "can_manage_users",
                      )
                    }
                  />

                  <PermissionToggle
                    label="Điều khiển Video"
                    icon={<VideoCameraIcon className="w-4 h-4 text-blue-400" />}
                    enabled={permissions.can_control_media}
                    onClick={() =>
                      onTogglePermission(
                        participant.user_id,
                        "can_control_media",
                      )
                    }
                  />
                  <div className="h-px bg-zinc-800 my-1" />
                </>
              )}

              {/* NÚT TRỤC XUẤT (HOST & MOD ĐỀU THẤY) */}
              <button
                onClick={() => {
                  onKick(participant.user_id);
                  setOpenMenu(null); // Đóng menu sau khi kick
                }}
                className="w-full text-left py-2 px-1 text-xs text-red-500 hover:text-red-400 transition flex items-center gap-2 font-bold group"
              >
                <XMarkIcon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                Trục xuất khỏi phòng
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// 3. COMPONENT PHỤ (CÔNG TẮC BẬT TẮT)
// ----------------------------------------------------------------------

function PermissionToggle({
  label,
  icon,
  enabled,
  onClick,
}: PermissionToggleProps) {
  return (
    <div
      className="flex items-center justify-between cursor-pointer group/toggle px-1 py-1"
      onClick={onClick}
      role="switch"
      aria-checked={enabled}
    >
      <div className="flex items-center gap-3">
        <div
          className={`p-2 rounded-lg transition-colors ${
            enabled ? "bg-white/10" : "bg-zinc-800"
          }`}
        >
          {icon}
        </div>
        <p className="text-xs text-zinc-200 font-bold">{label}</p>
      </div>

      {/* Thanh gạt Switch */}
      <div
        className={`w-8 h-4 rounded-full relative transition-colors ${
          enabled ? "bg-emerald-500" : "bg-zinc-700"
        }`}
      >
        {/* Nút tròn di chuyển */}
        <div
          className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${
            enabled ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </div>
    </div>
  );
}
