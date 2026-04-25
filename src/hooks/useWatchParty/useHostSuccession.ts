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
const GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 phút (300.000 ms)

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
  // Lưu thời điểm Host bắt đầu offline
  const [hostOfflineSince, setHostOfflineSince] = useState<number | null>(null);

  useEffect(() => {
    // 1. Nếu phòng đã đóng cửa thì ngưng ngay
    if (!isActive) {
      isPromoting.current = false;
      setHostOfflineSince(null);
      return;
    }

    // 2. Nếu mình đã là Host rồi thì reset trạng thái và thoát
    const amIAlreadyHost = participants.some(
      (p) => p.user_id === myId && p.role === "host",
    );

    if (amIAlreadyHost) {
      isPromoting.current = false;
      setHostOfflineSince(null);
      return;
    }

    // 3. Kiểm tra xem có Host nào đang Online không
    const onlineHost = participants.find(
      (p) => p.role === "host" && presenceData[p.user_id],
    );

    if (onlineHost) {
      // Nếu thấy Host online, reset thời gian chờ
      setHostOfflineSince(null);
      isPromoting.current = false;
      return;
    }

    // 4. Nếu không thấy Host online, bắt đầu đếm ngược
    if (hostOfflineSince === null) {
      setHostOfflineSince(Date.now());
      return;
    }

    // KIỂM TRA ĐIỀU KIỆN 5 PHÚT
    const elapsed = Date.now() - hostOfflineSince;
    if (elapsed < GRACE_PERIOD_MS) {
      // Chưa đủ 5 phút, chưa làm gì cả.
      // Effect sẽ tự chạy lại khi presenceData hoặc participants thay đổi.
      return;
    }

    // 5. Quá 5 phút rồi -> Tiến hành bầu chọn Tân Vương
    if (!isPromoting.current && myParticipantId) {
      const validCandidates = participants.filter(
        (p) => p.status === "approved" && presenceData[p.user_id],
      );

      if (!validCandidates.length) return;

      // Sắp xếp tìm người kế vị ưu tú nhất (Quyền cao -> Tham gia sớm)
      const survivors = [...validCandidates].sort((a, b) => {
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
      });

      const newKing = survivors[0];

      // Nếu mình là người đứng đầu danh sách kế vị
      if (newKing?.user_id === myId) {
        isPromoting.current = true;

        const promoteSelf = async () => {
          // Lọc danh sách Host cũ (đã offline quá 5p) để xóa
          const ghostHostIds = participants
            .filter((p) => p.role === "host" && p.user_id !== myId)
            .map((h) => h.id);

          try {
            // Cập nhật mình lên làm Host
            const { error } = await supabase
              .from("watch_party_participants")
              .update({
                role: "host",
                permissions: {
                  can_control_media: true,
                  can_manage_users: true,
                },
              })
              .eq("id", myParticipantId);

            if (error) throw error;

            toast.success(
              "Host cũ đã rời đi quá lâu. Bạn được chỉ định làm Chủ phòng mới!",
              {
                icon: "👑",
                id: SUCCESSION_TOAST_ID,
              },
            );

            // Xóa bản ghi của các Host cũ đã offline
            if (ghostHostIds.length > 0) {
              await supabase
                .from("watch_party_participants")
                .delete()
                .in("id", ghostHostIds);
            }

            setHostOfflineSince(null);
            refetch();
          } catch (error) {
            console.error("[HOST_SUCCESSION_ERROR]:", error);
            isPromoting.current = false;
            setHostOfflineSince(null);
            toast.error("Không thể tiếp quản vị trí Chủ phòng");
          }
        };

        promoteSelf();
      }
    }
  }, [
    participants,
    presenceData,
    myId,
    myParticipantId,
    supabase,
    refetch,
    isActive,
    hostOfflineSince,
  ]);
}
