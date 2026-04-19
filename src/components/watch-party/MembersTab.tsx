import { useEffect, useRef } from "react";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import ParticipantItem from "@/components/watch-party/ParticipantItem";
import ImageCustom from "@/components/ImageCustom";
import {
  UserPresence,
  WatchPartyParticipant,
  WatchPartyRoom,
} from "@/types/watch-party";
import { User } from "@supabase/supabase-js";

interface MembersTabProps {
  participants: WatchPartyParticipant[];
  presenceData: Record<string, UserPresence>;
  isRealHost: boolean;
  canManageUsers: boolean;
  user: User;
  room: WatchPartyRoom;
  onAction: (
    targetUserId: string,
    action: "approve" | "reject" | "kick",
  ) => Promise<void> | void;
  onTogglePermission: (
    targetUserId: string,
    key: keyof WatchPartyParticipant["permissions"],
  ) => Promise<void> | void;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
}

export default function MembersTab({
  participants,
  presenceData,
  isRealHost,
  canManageUsers,
  user,
  room,
  onAction,
  onTogglePermission,
  openMenuId,
  setOpenMenuId,
}: MembersTabProps) {
  const prevPendingCount = useRef<number>(0);

  useEffect(() => {
    if (!canManageUsers) return; // Mod cũng được nghe tiếng "Ting"
    const pendingCount = participants.filter(
      (p) => p.status === "pending",
    ).length;
    if (pendingCount > prevPendingCount.current) {
      const audio = new Audio(
        "https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3",
      );
      audio.volume = 0.4;
      audio.play().catch(() => {});
    }
    prevPendingCount.current = pendingCount;
  }, [participants, canManageUsers]);

  const approvedMembers = participants.filter((p) => p.status === "approved");
  const pendingRequests = participants.filter((p) => p.status === "pending");
  const isFull = approvedMembers.length >= room.max_participants;

  return (
    <div className="h-full overflow-y-auto space-y-6 custom-scrollbar pr-2">
      {/* 1. KHỐI CHỜ DUYỆT (Host và Mod đều thấy) */}
      {canManageUsers && pendingRequests.length > 0 && (
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
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <ImageCustom
                  className="size-9 rounded-full object-cover border border-red-500/30 shrink-0"
                  src={p.profiles?.avatar_url || "/default-avatar.png"}
                  alt={p.profiles?.full_name || "Người dùng ẩn danh"}
                  widths={[60]}
                />
                <span className="text-xs font-bold truncate text-white">
                  {p.profiles?.full_name || "Người dùng ẩn danh"}
                </span>
              </div>

              <div className="flex gap-1.5 shrink-0">
                <button
                  disabled={isFull}
                  onClick={() => onAction(p.user_id, "approve")}
                  className="p-2 bg-emerald-600 rounded-xl hover:bg-emerald-500 transition disabled:opacity-30"
                >
                  <CheckIcon className="w-4 h-4 text-white" />
                </button>
                <button
                  onClick={() => onAction(p.user_id, "reject")}
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
            {approvedMembers.length}/{room.max_participants}
          </span>
        </div>
        {approvedMembers.map((p) => (
          <ParticipantItem
            key={p.id}
            participant={p}
            presence={presenceData[p.user_id]}
            isRealHost={isRealHost} // Chuyền xuống
            canManageUsers={canManageUsers} // Chuyền xuống
            isMe={p.user_id === user.id}
            isOpenMenu={openMenuId === p.id}
            setOpenMenu={setOpenMenuId}
            onTogglePermission={onTogglePermission}
            onKick={(uid) => onAction(uid, "kick")}
          />
        ))}
      </div>
    </div>
  );
}
