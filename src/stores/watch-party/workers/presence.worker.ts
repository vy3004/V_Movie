// Zustand Worker - Background tasks running outside React lifecycle
// This worker handles Ghost Cleanup and Host Succession without causing re-renders

import { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { useWatchPartyStore } from "../index";

const GRACE_PERIOD_MS = 30 * 1000; // 30s cho Host Succession
const GHOST_CLEANUP_INTERVAL = 60 * 1000; // 60s dọn rác 1 lần
const GHOST_THRESHOLD_MS = 5 * 60 * 1000; // 5 phút

export function startPresenceWorker(supabase: SupabaseClient, roomId: string) {
  let hostOfflineTimer: NodeJS.Timeout | null = null;
  let detectedOfflineAt: number | null = null;
  let isPromoting = false;

  // ==========================================
  // 1. WORKER: DỌN DẸP GHOST USERS (Chạy định kỳ)
  // ==========================================
  const lastCleanupTrack: Record<string, number> = {};

  const ghostInterval: NodeJS.Timeout = setInterval(async () => {
    // Luôn lấy data tươi nhất, không sợ Stale Closure
    const state = useWatchPartyStore.getState();
    const { room, participants, presenceData, user } = state;

    // Kiểm tra xem mình có phải host không
    const isHost =
      participants.find((p) => p.user_id === user?.id)?.role === "host";

    // Chỉ Host mới được đi dọn rác
    if (!room?.is_active || !isHost) return;

    const now = Date.now();
    const ghostIds: string[] = [];

    participants.forEach((p) => {
      // Bỏ qua bản thân và những người đang online
      if (p.user_id === user?.id || presenceData[p.user_id]) {
        delete lastCleanupTrack[p.user_id];
        return;
      }

      // Phát hiện vắng mặt lần đầu
      if (!lastCleanupTrack[p.user_id]) {
        lastCleanupTrack[p.user_id] = now;
        return;
      }

      // Nếu vắng mặt quá 5 phút -> Chuẩn bị xóa
      if (now - lastCleanupTrack[p.user_id] >= GHOST_THRESHOLD_MS) {
        ghostIds.push(p.id);
      }
    });

    // Gọi API xóa thẳng tay
    if (ghostIds.length > 0) {
      console.log("[WORKER] Đang dọn dẹp Ghost Users...", ghostIds);
      const { error } = await supabase
        .from("watch_party_participants")
        .delete()
        .in("id", ghostIds);

      if (!error) {
        ghostIds.forEach((id) => delete lastCleanupTrack[id]);

        // Refetch participants
        const { data: updatedParticipants } = await supabase
          .from("watch_party_participants")
          .select("*, profiles:user_id(full_name, avatar_url)")
          .eq("room_id", roomId);

        if (updatedParticipants) {
          useWatchPartyStore.getState().setParticipants(updatedParticipants);
        }
      }
    }
  }, GHOST_CLEANUP_INTERVAL);

  // ==========================================
  // 2. WORKER: HOST SUCCESSION (Lắng nghe sự kiện)
  // ==========================================

  // Lắng nghe TỪNG SỰ THAY ĐỔI của mảng presenceData
  const unsubscribePresence = useWatchPartyStore.subscribe(
    (state, prevState) => {
      // This prevents the worker from running on every state update (video time, chat, etc.)
      if (state.presenceData === prevState.presenceData) return;

      const { room, participants, user, myParticipantId, presenceData } = state;

      // Kiểm tra xem mình có phải host không
      const isHost =
        participants.find((p) => p.user_id === user?.id)?.role === "host";

      if (!room?.is_active || isHost || isPromoting) return;

      const hostParticipant = participants.find((p) => p.role === "host");
      if (!hostParticipant) return;

      const isHostOnline = !!presenceData[hostParticipant.user_id];

      console.log("[WORKER] Host Succession check:", {
        hostUserId: hostParticipant.user_id,
        isHostOnline,
        detectedOfflineAt,
      });

      // TÌNH HUỐNG A: Host có mặt -> Hủy báo động
      if (isHostOnline) {
        if (hostOfflineTimer) {
          clearTimeout(hostOfflineTimer);
          hostOfflineTimer = null;
        }
        detectedOfflineAt = null;
        return;
      }

      // TÌNH HUỐNG B: Host vừa mất tích -> Bật báo động 30s
      if (!isHostOnline && detectedOfflineAt === null) {
        detectedOfflineAt = Date.now();
        console.log(
          "[WORKER] Host offline detected, starting 30s grace period",
        );

        hostOfflineTimer = setTimeout(async () => {
          // Lấy lại data mới nhất sau 30s
          const latestState = useWatchPartyStore.getState();

          const hostStillOffline =
            !latestState.presenceData[hostParticipant.user_id];

          if (!hostStillOffline) {
            console.log(
              "[WORKER] Host came back online, cancelling succession",
            );
            detectedOfflineAt = null;
            isPromoting = false;
            return;
          }

          const validCandidates = latestState.participants.filter(
            (p) =>
              p.status === "approved" && latestState.presenceData[p.user_id],
          );

          console.log("[WORKER] Grace period expired, valid candidates:", {
            count: validCandidates.length,
            candidates: validCandidates.map((p) => ({
              userId: p.user_id,
              role: p.role,
            })),
          });

          if (validCandidates.length === 0) return;

          // Thuật toán chọn người kế vị (Ưu tiên Mod -> Người vào sớm)
          const newKing = [...validCandidates].sort((a, b) => {
            const scoreA =
              (a.permissions?.can_manage_users ? 2 : 0) +
              (a.permissions?.can_control_media ? 1 : 0);
            const scoreB =
              (b.permissions?.can_manage_users ? 2 : 0) +
              (b.permissions?.can_control_media ? 1 : 0);
            if (scoreA !== scoreB) return scoreB - scoreA;
            return (
              new Date(a.created_at || 0).getTime() -
              new Date(b.created_at || 0).getTime()
            );
          })[0];

          console.log("[WORKER] Succession candidate:", {
            newKingUserId: newKing?.user_id,
            isMe: newKing?.user_id === user?.id,
            myId: user?.id,
          });

          // Nếu MÌNH là người được chọn
          if (newKing?.user_id === user?.id && myParticipantId) {
            isPromoting = true;
            console.log("[WORKER] I am the chosen one, promoting to host...");

            try {
              // Xóa ghost hosts trước
              const ghostHostIds = latestState.participants
                .filter(
                  (p) =>
                    p.role === "host" && !latestState.presenceData[p.user_id],
                )
                .map((h) => h.id);

              if (ghostHostIds.length > 0) {
                await supabase.rpc("cleanup_ghost_hosts", {
                  p_room_id: roomId,
                  p_ghost_host_ids: ghostHostIds,
                });
              }

              // Dùng RPC function để Promote Atomic
              const { data: promoted, error: rpcError } = await supabase.rpc(
                "promote_to_host_atomic",
                {
                  p_room_id: roomId,
                  p_candidate_id: myParticipantId,
                },
              );

              if (rpcError) {
                throw rpcError;
              }

              if (promoted) {
                toast.success(
                  "Host cũ đã rời đi quá lâu. Bạn được chỉ định làm Chủ phòng mới!",
                  { icon: "👑" },
                );

                // Refetch participants
                const { data: updatedParticipants } = await supabase
                  .from("watch_party_participants")
                  .select("*, profiles:user_id(full_name, avatar_url)")
                  .eq("room_id", roomId);

                if (updatedParticipants) {
                  useWatchPartyStore
                    .getState()
                    .setParticipants(updatedParticipants);
                }
              }
            } catch (error) {
              console.error("[WORKER] Bầu host thất bại:", error);
              toast.error("Không thể tiếp quản vị trí Chủ phòng");
            } finally {
              isPromoting = false;
              detectedOfflineAt = null;
            }
          }
        }, GRACE_PERIOD_MS);
      }
    },
  );

  // Trả về hàm dọn dẹp để gọi khi rời phòng
  return () => {
    clearInterval(ghostInterval);
    if (hostOfflineTimer) clearTimeout(hostOfflineTimer);
    unsubscribePresence();
    console.log("[WORKER] Presence worker stopped");
  };
}
