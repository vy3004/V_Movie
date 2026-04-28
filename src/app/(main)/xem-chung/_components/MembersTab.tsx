"use client";

import { useEffect, useRef, useMemo } from "react";
import {
  CheckIcon,
  XMarkIcon,
  MicrophoneIcon,
} from "@heroicons/react/24/outline";
import { Track } from "livekit-client";
import { toast } from "sonner";
import {
  useParticipants,
  useLocalParticipant,
  TrackToggle,
} from "@livekit/components-react";
import ParticipantItem from "@/app/(main)/xem-chung/_components/ParticipantItem";
import UserAvatar from "@/components/shared/UserAvatar";
import { useWatchParty } from "@/providers/WatchPartyProvider";

export default function MembersTab() {
  const {
    participants,
    presenceData,
    isRealHost,
    hasModeratorAuth,
    user,
    room,
    openMenuId,
    setOpenMenuId,
    handleParticipantAction,
    togglePermission,
    setKickTarget,
  } = useWatchParty();

  const lkParticipants = useParticipants();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();

  // --- LOGIC: TỰ ĐỘNG ÉP TẮT MIC KHI BỊ HOST CẤM (REAL-TIME) ---
  const myParticipantData = useMemo(() => {
    return participants.find((p) => p.user_id === user.id);
  }, [participants, user.id]);

  const isBannedFromVoice = myParticipantData?.is_voice_muted || false;

  useEffect(() => {
    if (isBannedFromVoice) {
      localParticipant?.audioTrackPublications.forEach((pub) => {
        if (!pub.isMuted) {
          pub.mute();
        }
      });
      if (isMicrophoneEnabled) {
        localParticipant?.setMicrophoneEnabled(false).catch(() => {});
        toast.error("Chủ phòng đã khóa Micro của bạn!");
      }
    }
  }, [isBannedFromVoice, localParticipant, isMicrophoneEnabled]);

  const prevPendingCount = useRef<number>(0);

  useEffect(() => {
    if (!hasModeratorAuth) return;
    const pendingRequests = participants.filter((p) => p.status === "pending");
    const pendingCount = pendingRequests.length;

    if (pendingCount > prevPendingCount.current) {
      const audio = new Audio(
        "https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3",
      );
      audio.volume = 0.4;
      audio.play().catch(() => {});
    }
    prevPendingCount.current = pendingCount;
  }, [participants, hasModeratorAuth]);

  const { approvedMembers, pendingRequests, isFull } = useMemo(() => {
    return {
      approvedMembers: participants.filter((p) => p.status === "approved"),
      pendingRequests: participants.filter((p) => p.status === "pending"),
      isFull:
        participants.filter((p) => p.status === "approved").length >=
        (room?.max_participants || 10),
    };
  }, [participants, room?.max_participants]);

  return (
    // Container chính: flex-col h-full và overflow-hidden để cố định kích thước tab
    <div className="h-full flex flex-col relative overflow-hidden">
      {/* Khu vực danh sách: flex-1 để tự co giãn và overflow-y-auto để cuộn độc lập */}
      <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pr-2 pb-4">
        {/* 1. KHỐI CHỜ DUYỆT */}
        {hasModeratorAuth && pendingRequests.length > 0 && (
          <div className="space-y-2 animate-in slide-in-from-top-4">
            <div className="flex justify-between items-center px-1">
              <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">
                Yêu cầu ({pendingRequests.length})
              </p>
              {isFull && (
                <span className="text-[9px] text-amber-500 font-bold animate-pulse uppercase">
                  Phòng đầy
                </span>
              )}
            </div>
            {pendingRequests.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-2.5 bg-red-500/5 rounded-2xl border border-red-500/20"
              >
                <div className="flex items-center gap-2">
                  <UserAvatar
                    avatar_url={p.profiles?.avatar_url}
                    user_name={p.profiles?.full_name || ""}
                    size={36}
                  />
                  <p className="text-sm font-bold truncate text-zinc-200">
                    {p.profiles?.full_name}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    disabled={isFull}
                    onClick={() =>
                      handleParticipantAction(
                        p.user_id,
                        "approve",
                        p.profiles?.full_name || "Thành viên",
                      )
                    }
                    className="p-2 bg-emerald-600 rounded-xl hover:bg-emerald-500 transition disabled:opacity-30"
                  >
                    <CheckIcon className="w-4 h-4 text-white" />
                  </button>
                  <button
                    onClick={() =>
                      handleParticipantAction(
                        p.user_id,
                        "reject",
                        p.profiles?.full_name || "Thành viên",
                      )
                    }
                    className="p-2 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition"
                  >
                    <XMarkIcon className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 2. KHỐI THÀNH VIÊN */}
        <div className="space-y-2">
          <div className="flex justify-between items-center px-1 mb-3">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
              Thành viên
            </p>
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-1 rounded-lg font-bold">
              {approvedMembers.length}/{room?.max_participants || 10}
            </span>
          </div>
          {approvedMembers.map((p) => {
            const isMe = p.user_id === user.id;
            const lkData = isMe
              ? localParticipant
              : lkParticipants.find((lp) => lp.identity === p.user_id);

            return (
              <ParticipantItem
                key={p.id}
                participant={p}
                presence={presenceData[p.user_id]}
                isRealHost={isRealHost}
                canManageUsers={hasModeratorAuth}
                isMe={isMe}
                isOpenMenu={openMenuId === p.id}
                setOpenMenu={setOpenMenuId}
                onTogglePermission={togglePermission}
                onKick={(uid) => {
                  const target = participants.find((p) => p.user_id === uid);
                  if (target) setKickTarget(target);
                }}
                isSpeaking={lkData?.isSpeaking}
                isMicEnabled={lkData?.isMicrophoneEnabled}
              />
            );
          })}
        </div>
      </div>

      <div className="shrink-0 p-3 bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-800 flex items-center justify-between rounded-b-xl z-10">
        <div className="flex items-center gap-3">
          <UserAvatar
            avatar_url={user.avatar_url || user.user_metadata.avatar_url}
            user_name={user.full_name || user.user_metadata.full_name}
            size={36}
            status="online"
          />
          <div className="flex flex-col">
            <span className="text-sm font-bold text-white truncate max-w-[100px]">
              {user.full_name || user.user_metadata.full_name}
            </span>
            <span className="text-[10px] text-green-500 font-bold uppercase tracking-widest">
              Connected
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* NÚT CAMERA */}
          <TrackToggle
            source={Track.Source.Camera}
            className="flex items-center justify-center w-10 h-10 rounded-full transition-all border bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700 data-[state=on]:bg-blue-500/20 data-[state=on]:border-blue-500/50 data-[state=on]:text-blue-400"
          />

          {/* NÚT MIC */}
          {isBannedFromVoice ? (
            <div
              className="flex items-center justify-center w-10 h-10 rounded-full border bg-zinc-900 border-zinc-800 text-zinc-600 opacity-50 cursor-not-allowed"
              title="Bạn đã bị chủ phòng cấm Mic"
              onClick={() => toast.error("Bạn đang bị cấm sử dụng Micro")}
            >
              <div className="relative flex items-center justify-center">
                <MicrophoneIcon className="w-5 h-5" />
                <div className="absolute w-[150%] h-[2px] bg-zinc-600 rotate-45 shadow-sm" />
              </div>
            </div>
          ) : (
            <TrackToggle
              source={Track.Source.Microphone}
              className={`flex items-center justify-center w-10 h-10 rounded-full transition-all border ${isMicrophoneEnabled ? "bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700" : "bg-red-500/20 border-red-500/40 text-red-500 hover:bg-red-500/30"}`}
            />
          )}
        </div>
      </div>
    </div>
  );
}
