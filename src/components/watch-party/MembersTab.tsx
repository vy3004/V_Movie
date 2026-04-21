"use client";

import React, { useEffect, useRef, useMemo } from "react";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import ParticipantItem from "@/components/watch-party/ParticipantItem";
import UserAvatar from "@/components/UserAvatar";
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

  const prevPendingCount = useRef<number>(0);

  // --- LOGIC THÔNG BÁO ÂM THANH (TING TING) ---
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

  // --- PHÂN LOẠI THÀNH VIÊN (Dùng useMemo để tối ưu hiệu năng) ---
  const { approvedMembers, pendingRequests, isFull } = useMemo(() => {
    const approved = participants.filter((p) => p.status === "approved");
    const pending = participants.filter((p) => p.status === "pending");
    return {
      approvedMembers: approved,
      pendingRequests: pending,
      isFull: approved.length >= (room?.max_participants || 10),
    };
  }, [participants, room?.max_participants]);

  return (
    <div className="h-full overflow-y-auto space-y-6 custom-scrollbar pr-2">
      {/* 1. KHỐI CHỜ DUYỆT (Chỉ Host và Mod thấy) */}
      {hasModeratorAuth && pendingRequests.length > 0 && (
        <div className="space-y-2 animate-in slide-in-from-top-4">
          <div className="flex justify-between items-center px-1">
            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">
              Yêu cầu ({pendingRequests.length})
            </p>
            {isFull && (
              <span className="text-[9px] text-amber-500 font-bold animate-pulse uppercase">
                Phòng đã đầy
              </span>
            )}
          </div>
          {pendingRequests.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between p-2.5 bg-red-500/5 rounded-2xl border border-red-500/20"
            >
              <UserAvatar
                avatar_url={p.profiles?.avatar_url}
                user_name={p.profiles?.full_name || ""}
                size={36}
              />

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

      {/* 2. KHỐI THÀNH VIÊN ĐÃ DUYỆT */}
      <div className="space-y-2">
        <div className="flex justify-between items-center px-1 mb-3">
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
            Thành viên
          </p>
          <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-1 rounded-lg font-bold">
            {approvedMembers.length}/{room?.max_participants}
          </span>
        </div>
        {approvedMembers.map((p) => (
          <ParticipantItem
            key={p.id}
            participant={p}
            presence={presenceData[p.user_id]}
            isRealHost={isRealHost}
            canManageUsers={hasModeratorAuth}
            isMe={p.user_id === user.id}
            isOpenMenu={openMenuId === p.id}
            setOpenMenu={setOpenMenuId}
            onTogglePermission={togglePermission}
            onKick={(uid) => {
              const target = participants.find((p) => p.user_id === uid);
              if (target) setKickTarget(target);
            }}
          />
        ))}
      </div>
    </div>
  );
}
