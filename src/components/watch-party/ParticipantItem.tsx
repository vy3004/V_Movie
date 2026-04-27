"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  VideoCameraIcon,
  ShieldCheckIcon,
  XMarkIcon,
  EllipsisVerticalIcon,
  NoSymbolIcon,
  ChatBubbleLeftEllipsisIcon,
  MicrophoneIcon,
} from "@heroicons/react/24/outline";
import UserAvatar from "@/components/UserAvatar";
import SpeakingEffect from "@/components/watch-party/SpeakingEffect";
import { VideoTrack, useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { UserPresence, WatchPartyParticipant } from "@/types/watch-party";

interface ParticipantItemProps {
  participant: WatchPartyParticipant;
  presence?: UserPresence;
  isRealHost: boolean;
  canManageUsers: boolean;
  isMe: boolean;
  onTogglePermission: (
    userId: string,
    key:
      | keyof WatchPartyParticipant["permissions"]
      | "is_muted"
      | "is_voice_muted",
  ) => void;
  onKick: (userId: string) => void;
  isOpenMenu: boolean;
  setOpenMenu: (id: string | null) => void;
  isSpeaking?: boolean;
  isMicEnabled?: boolean;
}

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
  isSpeaking = false,
  isMicEnabled = false,
}: ParticipantItemProps) {
  const isOnline = !!presence;
  const isAway = presence?.status === "away";
  const currentStatus = useMemo(
    () => (!isOnline ? "offline" : isAway ? "away" : "online"),
    [isOnline, isAway],
  );

  const cameraTracks = useTracks([Track.Source.Camera]);

  const myVideoTrack = useMemo(() => {
    return cameraTracks.find(
      (t) => t.participant.identity === participant.user_id,
    );
  }, [cameraTracks, participant.user_id]);

  const hasCamera = !!myVideoTrack;

  const canShowMenu = canManageUsers && !isMe && participant.role !== "host";

  const [menuCoords, setMenuCoords] = useState({ top: 0, left: 0 });
  const [menuDirection, setMenuDirection] = useState<"down" | "up">("down");

  const handleMenuToggle = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (isOpenMenu) {
        setOpenMenu(null);
      } else {
        const rect = e.currentTarget.getBoundingClientRect();
        const menuHeight = 320;
        const menuWidth = 224;

        const spaceBelow = window.innerHeight - rect.bottom;
        const shouldShowUp = spaceBelow < menuHeight && rect.top > menuHeight;

        setMenuDirection(shouldShowUp ? "up" : "down");
        setMenuCoords({
          top: shouldShowUp
            ? rect.top + window.scrollY - 8
            : rect.bottom + window.scrollY + 8,
          left: Math.max(10, rect.right - menuWidth + window.scrollX),
        });

        setOpenMenu(participant.id);
      }
    },
    [isOpenMenu, participant.id, setOpenMenu],
  );

  useEffect(() => {
    if (!isOpenMenu) return;

    const handleClose = () => setOpenMenu(null);
    window.addEventListener("scroll", handleClose, true);
    window.addEventListener("resize", handleClose);
    document.addEventListener("click", handleClose);

    return () => {
      window.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("resize", handleClose);
      document.removeEventListener("click", handleClose);
    };
  }, [isOpenMenu, setOpenMenu]);

  // --- PORTAL MENU RENDER ---
  const renderPortalMenu = () => {
    if (!isOpenMenu) return null;

    return createPortal(
      <div
        onClick={(e) => e.stopPropagation()} // Ngăn chặn đóng menu khi click vào bên trong menu
        style={{
          position: "absolute",
          top: menuCoords.top,
          left: menuCoords.left,
          transformOrigin:
            menuDirection === "up" ? "bottom right" : "top right",
        }}
        className={`w-56 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-[9999] p-3 space-y-4 animate-in fade-in zoom-in-95 duration-200 
          ${menuDirection === "up" ? "-translate-y-full border-b-red-600/50 border-b-2" : "border-t-red-600/50 border-t-2"}`}
      >
        {isRealHost && (
          <>
            <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest px-1">
              Hệ thống
            </p>
            <PermissionToggle
              label="Quản trị viên"
              icon={<ShieldCheckIcon className="w-4 h-4 text-emerald-400" />}
              enabled={participant.permissions.can_manage_users}
              onClick={() =>
                onTogglePermission(participant.user_id, "can_manage_users")
              }
            />
            <PermissionToggle
              label="Điều khiển Video"
              icon={<VideoCameraIcon className="w-4 h-4 text-blue-400" />}
              enabled={participant.permissions.can_control_media}
              onClick={() =>
                onTogglePermission(participant.user_id, "can_control_media")
              }
            />
            <div className="h-px bg-zinc-800 my-1" />
          </>
        )}

        <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest px-1">
          Kiểm soát
        </p>
        <PermissionToggle
          label={participant.is_muted ? "Mở khóa chat" : "Cấm chat"}
          icon={
            participant.is_muted ? (
              <ChatBubbleLeftEllipsisIcon className="w-4 h-4 text-emerald-400" />
            ) : (
              <NoSymbolIcon className="w-4 h-4 text-amber-500" />
            )
          }
          enabled={participant.is_muted}
          variant={participant.is_muted ? "default" : "danger"}
          onClick={() => onTogglePermission(participant.user_id, "is_muted")}
        />
        <PermissionToggle
          label={participant.is_voice_muted ? "Cho phép Mic" : "Cấm Mic"}
          icon={
            <MicrophoneIcon
              className={`w-4 h-4 ${participant.is_voice_muted ? "text-rose-500" : "text-emerald-400"}`}
            />
          }
          enabled={participant.is_voice_muted}
          variant={participant.is_voice_muted ? "default" : "danger"}
          onClick={() =>
            onTogglePermission(participant.user_id, "is_voice_muted")
          }
        />

        <div className="h-px bg-zinc-800 my-1" />
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
      </div>,
      document.body,
    );
  };

  return (
    <div className="group flex items-center gap-3 p-3 hover:bg-zinc-800/40 rounded-2xl transition border border-transparent hover:border-zinc-800 relative">
      <SpeakingEffect
        isSpeaking={isSpeaking && !participant.is_voice_muted}
        isMicEnabled={isMicEnabled}
        pulseColor={isMe ? "rose" : "emerald"}
        size={40}
      >
        {hasCamera ? (
          <div className="w-full h-full rounded-full overflow-hidden border-2 border-emerald-500 shadow-sm bg-zinc-900">
            <VideoTrack
              trackRef={myVideoTrack}
              className={`w-full h-full object-cover ${isMe ? "transform -scale-x-100" : ""}`}
            />
          </div>
        ) : (
          <UserAvatar
            avatar_url={participant.profiles?.avatar_url}
            user_name={participant.profiles?.full_name || ""}
            size={40}
            status={currentStatus}
          />
        )}
      </SpeakingEffect>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p
            className={`text-sm font-bold truncate ${participant.role === "host" ? "text-red-500" : "text-zinc-200"}`}
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
            <StatusBadge variant="host">Host</StatusBadge>
          )}
          {participant.permissions.can_manage_users && (
            <StatusBadge variant="mod">Mod</StatusBadge>
          )}
          {participant.is_muted && (
            <StatusBadge variant="mutedChat">Muted Chat</StatusBadge>
          )}
          {participant.is_voice_muted && (
            <StatusBadge
              variant="mutedVoice"
              icon={<MicrophoneIcon className="w-2 h-2" />}
            >
              Muted Voice
            </StatusBadge>
          )}
        </div>
      </div>

      {canShowMenu && (
        <div className="relative">
          <button
            onClick={handleMenuToggle}
            className={`p-2 rounded-xl transition outline-none ${isOpenMenu ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-white"}`}
          >
            <EllipsisVerticalIcon className="w-5 h-5" />
          </button>
          {renderPortalMenu()}
        </div>
      )}
    </div>
  );
}

function StatusBadge({
  variant,
  children,
  icon,
}: {
  variant: "host" | "mod" | "mutedChat" | "mutedVoice";
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  const styles = {
    host: "bg-red-500/10 text-red-500 border-red-500/20",
    mod: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    mutedChat: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    mutedVoice: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  };
  return (
    <span
      className={`text-[8px] px-1.5 py-0.5 rounded border font-black tracking-widest uppercase flex items-center gap-1 ${styles[variant]}`}
    >
      {icon}
      {children}
    </span>
  );
}

function PermissionToggle({
  label,
  icon,
  enabled,
  onClick,
  variant = "default",
}: {
  label: string;
  icon: React.ReactNode;
  enabled: boolean;
  onClick: () => void;
  variant?: "default" | "danger";
}) {
  return (
    <div
      className="flex items-center justify-between cursor-pointer group/toggle px-1 py-1 select-none"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className={`p-2 rounded-lg transition-colors ${enabled && variant === "default" ? "bg-emerald-500/10" : enabled && variant === "danger" ? "bg-amber-500/10" : "bg-zinc-800"}`}
        >
          {icon}
        </div>
        <p className="text-xs text-zinc-200 font-bold">{label}</p>
      </div>
      <div
        className={`w-8 h-4 rounded-full relative transition-colors ${enabled ? (variant === "danger" ? "bg-amber-600" : "bg-emerald-500") : "bg-zinc-700"}`}
      >
        <div
          className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${enabled ? "translate-x-4" : "translate-x-0.5"}`}
        />
      </div>
    </div>
  );
}
