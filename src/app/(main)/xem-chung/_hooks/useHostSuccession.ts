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
const GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 phút

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

  // State giả để ép React chạy lại Effect khi hết 5 phút
  const [, forceUpdate] = useState({});

  useEffect(() => {
    let timerId: NodeJS.Timeout | undefined;

    if (hostOfflineSince !== null && isActive) {
      const remaining = GRACE_PERIOD_MS - (Date.now() - hostOfflineSince);
      if (remaining > 0) {
        // Đặt đồng hồ báo thức chạy lại effect đúng lúc hết 5 phút
        timerId = setTimeout(() => forceUpdate({}), remaining + 100);
      }
    }

    const checkAndPromote = async () => {
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
      if (elapsed < GRACE_PERIOD_MS) return;

      // 5. Quá 5 phút rồi -> Tiến hành bầu chọn Tân Vương
      if (!isPromoting.current && myParticipantId) {
        const validCandidates = participants.filter(
          (p) => p.status === "approved" && presenceData[p.user_id],
        );

        if (!validCandidates.length) return;

        // Luật thừa kế: Ai có quyền cao hơn, hoặc ai vào phòng sớm hơn (created_at)
        const survivors = [...validCandidates].sort((a, b) => {
          const scoreA =
            (a.permissions?.can_manage_users ? 2 : 0) +
            (a.permissions?.can_control_media ? 1 : 0);
          const scoreB =
            (b.permissions?.can_manage_users ? 2 : 0) +
            (b.permissions?.can_control_media ? 1 : 0);

          if (scoreA !== scoreB) return scoreB - scoreA;

          return (
            new Date(a.created_at || Date.now()).getTime() -
            new Date(b.created_at || Date.now()).getTime()
          );
        });

        const newKing = survivors[0];

        // Nếu mình là người đứng đầu danh sách kế vị
        if (newKing?.user_id === myId) {
          isPromoting.current = true;

          try {
            // --- CHỐNG RACE CONDITION TRỰC TIẾP TỪ DATABASE ---
            // Truy vấn nhanh xem trong phòng ĐÃ CÓ AI lên làm Host trước mình 1 nhịp chưa?
            const participantIds = participants.map((p) => p.id);
            const { data: currentRealHosts } = await supabase
              .from("watch_party_participants")
              .select("id")
              .in("id", participantIds)
              .eq("role", "host");

            // Nếu DB trả về đã có ông nào đó làm Host rồi -> Hủy bỏ ngay lập tức
            if (currentRealHosts && currentRealHosts.length > 0) {
              isPromoting.current = false;
              return;
            }

            // Nếu DB sạch sẽ chưa có Host mới -> Cập nhật bản thân
            const { error } = await supabase
              .from("watch_party_participants")
              .update({
                role: "host",
                permissions: {
                  can_control_media: true,
                  can_manage_users: true,
                },
              })
              .eq("id", myParticipantId)
              .eq("role", "participant");

            if (error) throw error;

            toast.success(
              "Host cũ đã rời đi quá lâu. Bạn được chỉ định làm Chủ phòng mới!",
              {
                icon: "👑",
                id: SUCCESSION_TOAST_ID,
              },
            );

            // Xóa các Host cũ (Ghost hosts)
            const ghostHostIds = participants
              .filter((p) => p.role === "host" && p.user_id !== myId)
              .map((h) => h.id);

            if (ghostHostIds.length > 0) {
              const { error: deleteError } = await supabase
                .from("watch_party_participants")
                .delete()
                .in("id", ghostHostIds);

              if (deleteError) {
                console.warn(
                  "[HOST_SUCCESSION] Failed to delete ghost hosts:",
                  deleteError,
                );
              }
            }

            isPromoting.current = false;
            setHostOfflineSince(null);
            refetch();
          } catch (error) {
            console.error("[HOST_SUCCESSION_ERROR]:", error);
            isPromoting.current = false;
            setHostOfflineSince(null);
            toast.error("Không thể tiếp quản vị trí Chủ phòng");
          }
        }
      }
    };

    checkAndPromote();

    // Dọn dẹp timer khi component unmount
    return () => {
      if (timerId) clearTimeout(timerId);
    };
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
