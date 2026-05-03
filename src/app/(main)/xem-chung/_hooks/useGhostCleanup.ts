"use client";

import { useEffect, useRef } from "react";
import { SupabaseClient } from "@supabase/supabase-js";
import { WatchPartyParticipant, UserPresence } from "@/types";

interface GhostCleanupProps {
  participants: WatchPartyParticipant[];
  presenceData: Record<string, UserPresence>;
  myId: string;
  isHost: boolean;
  supabase: SupabaseClient;
  refetch: () => void;
  isActive: boolean;
}

const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 phút
const GHOST_THRESHOLD_MS = 5 * 60 * 1000; // 5 phút không có presence = ghost

/**
 * Hook để cleanup ghost users (users không còn presence)
 * Chạy định kỳ mỗi 1 phút để xóa những user đã offline quá lâu
 */
export function useGhostCleanup({
  participants,
  presenceData,
  myId,
  isHost,
  supabase,
  refetch,
  isActive,
}: GhostCleanupProps) {
  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const lastCleanupRef = useRef<Record<string, number>>({});
  const isCleaningRef = useRef(false);

  // Use refs to avoid stale closures in interval callback
  const participantsRef = useRef(participants);
  const presenceDataRef = useRef(presenceData);

  // Keep refs updated
  useEffect(() => {
    participantsRef.current = participants;
    presenceDataRef.current = presenceData;
  }, [participants, presenceData]);

  useEffect(() => {
    // ✅ CHỈ HOST MỚI ĐƯỢC CHẠY GHOST CLEANUP
    if (!isActive || !isHost) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
      return;
    }

    const cleanupGhosts = async () => {
      // Guard against concurrent executions
      if (isCleaningRef.current) return;
      isCleaningRef.current = true;

      try {
        const now = Date.now();
        const currentParticipants = participantsRef.current;
        const currentPresenceData = presenceDataRef.current;

        // Tìm ghost users: có trong DB nhưng không có presence
        const ghostCandidates = currentParticipants.filter(
          (p) => p.user_id !== myId && !currentPresenceData[p.user_id],
        );

        if (ghostCandidates.length === 0) {
          return;
        }

        // Lọc ra những ghost đã offline đủ lâu
        const confirmedGhosts = ghostCandidates.filter((p) => {
          const lastSeen = lastCleanupRef.current[p.user_id];

          // Lần đầu phát hiện ghost → ghi nhận thời gian
          if (!lastSeen) {
            lastCleanupRef.current[p.user_id] = now;
            return false;
          }

          // Đã offline quá GHOST_THRESHOLD_MS → xác nhận là ghost
          return now - lastSeen >= GHOST_THRESHOLD_MS;
        });

        if (confirmedGhosts.length === 0) {
          return;
        }

        console.log("[GHOST_CLEANUP] Removing ghost users:", {
          count: confirmedGhosts.length,
          userIds: confirmedGhosts.map((g) => g.user_id),
        });

        const ghostIds = confirmedGhosts.map((g) => g.id);

        const { error } = await supabase
          .from("watch_party_participants")
          .delete()
          .in("id", ghostIds);

        if (error) {
          console.error("[GHOST_CLEANUP] Failed to delete ghosts:", error);
        } else {
          console.log("[GHOST_CLEANUP] Successfully removed ghosts");

          // Xóa khỏi tracking
          confirmedGhosts.forEach((g) => {
            delete lastCleanupRef.current[g.user_id];
          });

          refetch();
        }
      } finally {
        isCleaningRef.current = false;
      }
    };

    // Sau đó chạy định kỳ
    intervalRef.current = setInterval(cleanupGhosts, CLEANUP_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    };
  }, [myId, isHost, supabase, refetch, isActive]);

  // Cleanup tracking khi user quay lại online
  useEffect(() => {
    Object.keys(lastCleanupRef.current).forEach((userId) => {
      if (presenceData[userId]) {
        delete lastCleanupRef.current[userId];
      }
    });
  }, [presenceData]);
}
