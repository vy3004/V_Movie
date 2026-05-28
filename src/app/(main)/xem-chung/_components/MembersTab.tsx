"use client";

import { useEffect, useRef, useMemo, useCallback } from "react";
import ApprovedMembersSection from "@/app/(main)/xem-chung/_components/members/ApprovedMembersSection";
import MemberVoiceFooter from "@/app/(main)/xem-chung/_components/members/MemberVoiceFooter";
import PendingRequestsSection from "@/app/(main)/xem-chung/_components/members/PendingRequestsSection";
import { WatchPartyParticipant } from "@/types/watch-party";
import {
  useWatchPartyStore,
  selectParticipants,
  selectIsHost,
  selectHasPermission,
  selectUser,
  selectRoom,
} from "@/stores/watch-party";

export default function MembersTab() {
  const participants = useWatchPartyStore(selectParticipants);
  const isRealHost = useWatchPartyStore(selectIsHost);
  const selectCanManageUsers = useMemo(
    () => selectHasPermission("can_manage_users"),
    [],
  );
  const hasModeratorAuth = useWatchPartyStore(selectCanManageUsers);
  const user = useWatchPartyStore(selectUser);
  const room = useWatchPartyStore(selectRoom);
  const wantsVoiceConnected = useWatchPartyStore(
    (state) => state.wantsVoiceConnected,
  );
  const isVoiceConnected = useWatchPartyStore(
    (state) => state.isVoiceConnected,
  );
  const setWantsVoiceConnected = useWatchPartyStore(
    (state) => state.setWantsVoiceConnected,
  );
  const setKickTarget = useWatchPartyStore((state) => state.setKickTarget);

  const myParticipantData = useMemo(() => {
    return participants.find((p) => p.user_id === user?.id);
  }, [participants, user?.id]);

  const isBannedFromVoice = myParticipantData?.is_voice_muted || false;

  const prevPendingCount = useRef<number | null>(null);
  const pendingAudioRef = useRef<HTMLAudioElement | null>(null);

  const { approvedMemberIds, pendingRequests, pendingCount, isFull } =
    useMemo(() => {
      const approvedMemberIds: string[] = [];
      const pendingRequests: WatchPartyParticipant[] = [];

      for (const participant of participants) {
        if (participant.status === "approved") {
          approvedMemberIds.push(participant.id);
        } else if (participant.status === "pending") {
          pendingRequests.push(participant);
        }
      }

      return {
        approvedMemberIds,
        pendingRequests,
        pendingCount: pendingRequests.length,
        isFull: approvedMemberIds.length >= (room?.max_participants || 10),
      };
    }, [participants, room?.max_participants]);

  useEffect(() => {
    if (!hasModeratorAuth) return;

    if (prevPendingCount.current === null) {
      prevPendingCount.current = pendingCount;
      return;
    }

    if (pendingCount > prevPendingCount.current) {
      const audio =
        pendingAudioRef.current ?? new Audio("/sounds/pending-request.mp3");
      pendingAudioRef.current = audio;
      audio.volume = 0.4;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }

    prevPendingCount.current = pendingCount;
  }, [pendingCount, hasModeratorAuth]);

  const handleKickClick = useCallback(
    (targetParticipant: WatchPartyParticipant) => {
      setKickTarget(targetParticipant);
    },
    [setKickTarget],
  );

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pr-2 pb-4">
        {hasModeratorAuth && (
          <PendingRequestsSection
            pendingRequests={pendingRequests}
            isFull={isFull}
          />
        )}

        <ApprovedMembersSection
          approvedMemberIds={approvedMemberIds}
          maxParticipants={room?.max_participants || 10}
          isRealHost={isRealHost}
          canManageUsers={hasModeratorAuth}
          userId={user?.id}
          guestCanChat={room?.settings?.guest_can_chat ?? true}
          onKick={handleKickClick}
        />
      </div>

      <MemberVoiceFooter
        myParticipantData={myParticipantData}
        wantsVoiceConnected={wantsVoiceConnected}
        isVoiceConnected={isVoiceConnected}
        isBannedFromVoice={isBannedFromVoice}
        setWantsVoiceConnected={setWantsVoiceConnected}
      />
    </div>
  );
}
