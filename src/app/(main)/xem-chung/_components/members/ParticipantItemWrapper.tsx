"use client";

import { useCallback } from "react";
import ParticipantItem from "@/app/(main)/xem-chung/_components/ParticipantItem";
import { useWatchPartyStore } from "@/stores/watch-party";
import { WatchPartyParticipant } from "@/types/watch-party";

interface ParticipantItemWrapperProps {
  participantId: string;
  isRealHost: boolean;
  canManageUsers: boolean;
  userId?: string;
  guestCanChat: boolean;
  onTogglePermission: (
    userId: string,
    key: string,
    participant?: WatchPartyParticipant,
  ) => Promise<void>;
  onKick: (participant: WatchPartyParticipant) => void;
}

export default function ParticipantItemWrapper({
  participantId,
  isRealHost,
  canManageUsers,
  userId,
  guestCanChat,
  onTogglePermission,
  onKick,
}: ParticipantItemWrapperProps) {
  const participant = useWatchPartyStore(
    useCallback(
      (state) => state.participants.find((p) => p.id === participantId),
      [participantId],
    ),
  );

  if (!participant) return null;

  return (
    <ParticipantItem
      participant={participant}
      isRealHost={isRealHost}
      canManageUsers={canManageUsers}
      isMe={participant.user_id === userId}
      guestCanChat={guestCanChat}
      onTogglePermission={onTogglePermission}
      onKick={() => onKick(participant)}
    />
  );
}
