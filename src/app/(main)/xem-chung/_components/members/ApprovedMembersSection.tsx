"use client";

import { memo } from "react";
import ParticipantItemWrapper from "./ParticipantItemWrapper";
import { togglePermission } from "@/stores/watch-party";
import { WatchPartyParticipant } from "@/types/watch-party";

function areStringArraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

interface ApprovedMembersSectionProps {
  approvedMemberIds: string[];
  maxParticipants: number;
  isRealHost: boolean;
  canManageUsers: boolean;
  userId?: string;
  guestCanChat: boolean;
  onKick: (participant: WatchPartyParticipant) => void;
}

function ApprovedMembersSection({
  approvedMemberIds,
  maxParticipants,
  isRealHost,
  canManageUsers,
  userId,
  guestCanChat,
  onKick,
}: ApprovedMembersSectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center px-1 mb-3">
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
          Thành viên
        </p>
        <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-1 rounded-lg font-bold">
          {approvedMemberIds.length}/{maxParticipants}
        </span>
      </div>
      {approvedMemberIds.map((participantId) => (
        <ParticipantItemWrapper
          key={participantId}
          participantId={participantId}
          isRealHost={isRealHost}
          canManageUsers={canManageUsers}
          userId={userId}
          guestCanChat={guestCanChat}
          onTogglePermission={togglePermission}
          onKick={onKick}
        />
      ))}
    </div>
  );
}

export default memo(
  ApprovedMembersSection,
  (prev, next) =>
    areStringArraysEqual(prev.approvedMemberIds, next.approvedMemberIds) &&
    prev.maxParticipants === next.maxParticipants &&
    prev.isRealHost === next.isRealHost &&
    prev.canManageUsers === next.canManageUsers &&
    prev.userId === next.userId &&
    prev.guestCanChat === next.guestCanChat &&
    prev.onKick === next.onKick,
);
