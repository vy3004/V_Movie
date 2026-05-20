"use client";

import { memo, useCallback, useState } from "react";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import UserAvatar from "@/components/shared/UserAvatar";
import { getParticipantIdentity, handleParticipantAction } from "@/stores/watch-party";
import { WatchPartyParticipant } from "@/types/watch-party";

interface PendingRequestsSectionProps {
  pendingRequests: WatchPartyParticipant[];
  isFull: boolean;
}

function PendingRequestsSection({
  pendingRequests,
  isFull,
}: PendingRequestsSectionProps) {
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);

  const runAction = useCallback(
    async (participant: WatchPartyParticipant, action: "approve" | "reject") => {
      if (loadingUserId) return;

      setLoadingUserId(participant.user_id);
      try {
        await handleParticipantAction(
          participant.user_id,
          action,
          participant.profiles?.full_name || "Thành viên",
        );
      } finally {
        setLoadingUserId(null);
      }
    },
    [loadingUserId],
  );

  if (pendingRequests.length === 0) return null;

  return (
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
      {pendingRequests.map((p) => {
        const isLoading = loadingUserId === p.user_id;
        const identity = getParticipantIdentity(p);

        return (
          <div
            key={p.id}
            className="flex items-center justify-between p-2.5 bg-red-500/5 rounded-2xl border border-red-500/20"
          >
            <div className="flex items-center gap-2">
              <UserAvatar
                avatar_url={identity.avatarUrl}
                user_name={identity.fullName}
                size={36}
              />
              <p className="text-sm font-bold truncate text-zinc-200">
                {identity.fullName}
              </p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button
                disabled={isFull || isLoading}
                onClick={() => runAction(p, "approve")}
                className="p-2 bg-emerald-600 rounded-xl hover:bg-emerald-500 transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <CheckIcon className="w-4 h-4 text-white" />
              </button>
              <button
                disabled={isLoading}
                onClick={() => runAction(p, "reject")}
                className="p-2 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <XMarkIcon className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default memo(PendingRequestsSection);
