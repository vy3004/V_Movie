"use client";

import { useEffect, useRef, useState } from "react";
import { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { WatchPartyParticipant, UserPresence } from "@/types";

interface HostSuccessionProps {
  participants: WatchPartyParticipant[];
  presenceData: Record<string, UserPresence>;
  myId: string;
  myParticipantId: string | undefined;
  supabase: SupabaseClient;
  refetch: () => void;
  isActive: boolean;
}

const SUCCESSION_TOAST_ID = "host-succession-toast";
const GRACE_PERIOD_MS = 30 * 1000; // 30 giây

export function useHostSuccession({
  participants,
  presenceData,
  myId,
  myParticipantId,
  supabase,
  refetch,
  isActive,
}: HostSuccessionProps) {
  const isPromoting = useRef(false);
  const timerIdRef = useRef<NodeJS.Timeout | undefined>(undefined);
  // Lưu thời điểm phát hiện Host offline lần đầu
  const [detectedOfflineAt, setDetectedOfflineAt] = useState<number | null>(
    null,
  );

  // State để trigger recheck khi timer hết
  const [recheckTrigger, setRecheckTrigger] = useState(0);

  useEffect(() => {
    // Clear timer cũ khi effect re-run
    if (timerIdRef.current) {
      clearTimeout(timerIdRef.current);
      timerIdRef.current = undefined;
    }

    const checkAndPromote = async () => {
      if (!isActive) {
        isPromoting.current = false;
        setDetectedOfflineAt(null);
        return;
      }

      // 2. Nếu mình đã là Host rồi thì reset trạng thái và thoát
      const amIAlreadyHost = participants.some(
        (p) => p.user_id === myId && p.role === "host",
      );

      if (amIAlreadyHost) {
        isPromoting.current = false;
        setDetectedOfflineAt(null);
        return;
      }

      // 3. Tìm Host trong danh sách participants
      const hostParticipant = participants.find((p) => p.role === "host");

      if (!hostParticipant) {
        setDetectedOfflineAt(null);
        return;
      }

      // 4. Kiểm tra Host có online không (có trong presenceData)
      const hostPresence = presenceData[hostParticipant.user_id];

      if (hostPresence) {
        // Host đang online, reset timer
        setDetectedOfflineAt(null);
        isPromoting.current = false;
        return;
      }

      // 5. Host offline - Lấy thời gian online_at cuối cùng từ các presence khác
      // (vì host đã mất kết nối nên không còn trong presenceData)
      // Tìm presence gần nhất để ước tính thời gian host offline
      const now = Date.now();

      // Lưu lại thời điểm phát hiện host offline lần đầu
      if (detectedOfflineAt === null) {
        setDetectedOfflineAt(now);

        // Đặt timer để check lại sau GRACE_PERIOD_MS
        timerIdRef.current = setTimeout(() => {
          setRecheckTrigger((prev) => prev + 1);
        }, GRACE_PERIOD_MS + 100);
        return;
      }

      // 6. Tính thời gian đã offline kể từ lúc phát hiện lần đầu
      const offlineDuration = now - detectedOfflineAt;

      if (offlineDuration < GRACE_PERIOD_MS) {
        // Chưa đủ thời gian, đặt timer cho phần còn lại
        const remaining = GRACE_PERIOD_MS - offlineDuration;
        timerIdRef.current = setTimeout(() => {
          setRecheckTrigger((prev) => prev + 1);
        }, remaining + 100);
        return;
      }

      // 7. Tiến hành bầu chọn Tân Vương
      if (!isPromoting.current && myParticipantId) {
        const validCandidates = participants.filter(
          (p) => p.status === "approved" && presenceData[p.user_id],
        );

        if (!validCandidates.length) {
          return;
        }

        // Luật thừa kế: Ai có quyền cao hơn, hoặc ai vào phòng sớm hơn (created_at)
        const fallbackTime = Date.now();
        const survivors = [...validCandidates].sort((a, b) => {
          const scoreA =
            (a.permissions?.can_manage_users ? 2 : 0) +
            (a.permissions?.can_control_media ? 1 : 0);
          const scoreB =
            (b.permissions?.can_manage_users ? 2 : 0) +
            (b.permissions?.can_control_media ? 1 : 0);

          if (scoreA !== scoreB) return scoreB - scoreA;

          // Participant thiếu created_at sẽ bị deprioritize (coi như mới nhất)
          return (
            new Date(a.created_at || fallbackTime).getTime() -
            new Date(b.created_at || fallbackTime).getTime()
          );
        });

        const newKing = survivors[0];

        // Nếu mình là người đứng đầu danh sách kế vị
        if (newKing?.user_id === myId) {
          isPromoting.current = true;

          try {
            // --- BƯỚC 1: XÓA GHOST HOST TRƯỚC ---
            // Host không còn presence nhưng vẫn còn trong DB → xóa trước
            const ghostHostIds = participants
              .filter((p) => p.role === "host" && !presenceData[p.user_id])
              .map((h) => h.id);

            if (ghostHostIds.length > 0) {
              // Sử dụng RPC để xóa ghost hosts (bypass RLS)
              const { error: deleteError } = await supabase.rpc(
                "cleanup_ghost_hosts",
                {
                  p_room_id: participants[0]?.room_id,
                  p_ghost_host_ids: ghostHostIds,
                },
              );

              if (deleteError) {
                console.warn(
                  "[HOST_SUCCESSION] Failed to delete ghost hosts:",
                  deleteError,
                );
              }
            }

            // --- BƯỚC 2: SỬ DỤNG RPC FUNCTION ĐỂ PROMOTE ---
            // Database sẽ đảm bảo chỉ 1 client được promote thành công
            const { data: promoted, error: rpcError } = await supabase.rpc(
              "promote_to_host_atomic",
              {
                p_room_id: participants[0]?.room_id,
                p_candidate_id: myParticipantId,
              },
            );

            if (rpcError) {
              throw rpcError;
            }

            // Chỉ client được promote mới vào đây
            if (promoted) {
              toast.success(
                "Host cũ đã rời đi quá lâu. Bạn được chỉ định làm Chủ phòng mới!",
                {
                  icon: "👑",
                  id: SUCCESSION_TOAST_ID,
                },
              );

              // Xóa ghost users (không còn presence)
              const ghostUserIds = participants
                .filter(
                  (p) =>
                    p.user_id !== myId &&
                    !presenceData[p.user_id] &&
                    p.status === "approved",
                )
                .map((u) => u.id);

              if (ghostUserIds.length > 0) {
                const { error: deleteError } = await supabase
                  .from("watch_party_participants")
                  .delete()
                  .in("id", ghostUserIds);

                if (deleteError) {
                  console.warn(
                    "[HOST_SUCCESSION] Failed to delete ghost users:",
                    deleteError,
                  );
                }
              }

              refetch();
            }

            isPromoting.current = false;
            setDetectedOfflineAt(null);
          } catch (error) {
            console.error("[HOST_SUCCESSION_ERROR]:", error);
            isPromoting.current = false;
            setDetectedOfflineAt(null);
            toast.error("Không thể tiếp quản vị trí Chủ phòng");
          }
        }
      }
    };

    checkAndPromote();

    // Dọn dẹp timer khi component unmount
    return () => {
      if (timerIdRef.current) {
        clearTimeout(timerIdRef.current);
        timerIdRef.current = undefined;
      }
    };
  }, [
    participants,
    presenceData,
    myId,
    myParticipantId,
    supabase,
    refetch,
    isActive,
    detectedOfflineAt,
    recheckTrigger,
  ]);
}
