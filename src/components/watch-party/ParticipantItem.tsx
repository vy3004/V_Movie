"use client";

import React, { useMemo } from "react";
import {
  VideoCameraIcon,
  ShieldCheckIcon,
  XMarkIcon,
  EllipsisVerticalIcon,
  NoSymbolIcon, // Icon cấm chat
  ChatBubbleLeftEllipsisIcon, // Icon mở chat
} from "@heroicons/react/24/outline";
import UserAvatar from "@/components/UserAvatar";
import { UserPresence, WatchPartyParticipant } from "@/types/watch-party";

// ----------------------------------------------------------------------
// 1. ĐỊNH NGHĨA TYPES
// ----------------------------------------------------------------------

interface ParticipantItemProps {
  participant: WatchPartyParticipant;
  presence?: UserPresence;
  isRealHost: boolean;
  canManageUsers: boolean;
  isMe: boolean;
  // Cập nhật Type: Chấp nhận cả key của permissions và key "is_muted"
  onTogglePermission: (
    userId: string,
    key: keyof WatchPartyParticipant["permissions"] | "is_muted",
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
  variant?: "default" | "danger";
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
  const isOnline = !!presence;
  const isAway = presence?.status === "away";
  const currentStatus = useMemo(() => {
    if (!isOnline) return "offline";
    if (isAway) return "away";
    return "online";
  }, [isOnline, isAway]);

  const canShowMenu = canManageUsers && !isMe && participant.role !== "host";

  const permissions = participant.permissions || {
    can_manage_users: false,
    can_control_media: false,
  };

  const isMuted = participant.is_muted;

  return (
    <div className="group flex items-center gap-3 p-3 hover:bg-zinc-800/40 rounded-2xl transition border border-transparent hover:border-zinc-800 relative">
      {/* --- CỘT 1: AVATAR --- */}
      <UserAvatar
        avatar_url={participant.profiles?.avatar_url}
        user_name={participant.profiles?.full_name || ""}
        size={36}
        status={currentStatus}
      />

      {/* --- CỘT 2: THÔNG TIN --- */}
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

        <div className="flex flex-wrap gap-1.5 mt-1">
          {participant.role === "host" && (
            <span className="text-[8px] bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded border border-red-500/20 font-black tracking-widest uppercase">
              Host
            </span>
          )}

          {permissions.can_manage_users && (
            <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 font-black tracking-widest uppercase">
              Mod
            </span>
          )}

          {isMuted && (
            <span className="text-[8px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/20 font-black tracking-widest uppercase">
              Muted
            </span>
          )}

          {permissions.can_control_media && (
            <span className="text-[8px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20 font-black tracking-widest uppercase">
              Remote
            </span>
          )}
        </div>
      </div>

      {/* --- CỘT 3: NÚT THAO TÁC --- */}
      {canShowMenu && (
        <div className="relative">
          <button
            onClick={() => setOpenMenu(isOpenMenu ? null : participant.id)}
            className={`p-2 rounded-xl transition outline-none ${
              isOpenMenu
                ? "bg-zinc-800 text-white"
                : "text-zinc-500 hover:text-white"
            }`}
          >
            <EllipsisVerticalIcon className="w-5 h-5" />
          </button>

          {isOpenMenu && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-[100] p-3 space-y-4 animate-in fade-in zoom-in-95 origin-top-right border-t-red-600/50 border-t-2">
              {/* KHU VỰC PHÂN QUYỀN (CHỈ HOST MỚI THẤY) */}
              {isRealHost && (
                <>
                  <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest px-1">
                    Hệ thống
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

              {/* KHU VỰC ĐIỀU KIỂM SOÁT (HOST & MOD ĐỀU THẤY) */}
              <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest px-1">
                Kiểm soát
              </p>

              <PermissionToggle
                label={isMuted ? "Mở khóa chat" : "Cấm chat"}
                icon={
                  isMuted ? (
                    <ChatBubbleLeftEllipsisIcon className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <NoSymbolIcon className="w-4 h-4 text-amber-500" />
                  )
                }
                enabled={isMuted}
                variant={isMuted ? "default" : "danger"}
                onClick={() =>
                  onTogglePermission(participant.user_id, "is_muted")
                }
              />

              <button
                onClick={() => {
                  onKick(participant.user_id);
                  setOpenMenu(null);
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
  variant = "default",
}: PermissionToggleProps) {
  return (
    <div
      className="flex items-center justify-between cursor-pointer group/toggle px-1 py-1"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        }
      }}
      tabIndex={0}
      role="switch"
      aria-checked={enabled}
    >
      <div className="flex items-center gap-3">
        <div
          className={`p-2 rounded-lg transition-colors ${
            enabled && variant === "default"
              ? "bg-emerald-500/10"
              : enabled && variant === "danger"
                ? "bg-amber-500/10"
                : "bg-zinc-800"
          }`}
        >
          {icon}
        </div>
        <p className="text-xs text-zinc-200 font-bold">{label}</p>
      </div>
      <div
        className={`w-8 h-4 rounded-full relative transition-colors ${
          enabled
            ? variant === "danger"
              ? "bg-amber-600"
              : "bg-emerald-500"
            : "bg-zinc-700"
        }`}
      >
        <div
          className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${
            enabled ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </div>
    </div>
  );
}
