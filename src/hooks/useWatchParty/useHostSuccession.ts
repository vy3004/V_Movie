"use client";

import { useEffect, useRef } from "react";
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

  useEffect(() => {
    // Nếu phòng đã đóng cửa thì ngưng ngay mọi hoạt động kế vị
    // Ngăn chặn tình trạng vừa hiện thông báo "Phòng đóng" vừa được phong làm Vua
    if (!isActive) {
      isPromoting.current = false;
      return;
    }

    // Nếu mình đã là Host rồi thì thoát ngay lập tức
    const amIAlreadyHost = participants.some(
      (p) => p.user_id === myId && p.role === "host",
    );

    if (amIAlreadyHost) {
      isPromoting.current = false;
      return;
    }

    // 3. Kiểm tra xem có Host nào khác đang Online không
    const currentHost = participants.find(
      (p) => p.role === "host" && presenceData[p.user_id],
    );

    if (currentHost) {
      isPromoting.current = false;
      return;
    }

    // Guard clause cơ bản
    if (!participants.length || !myParticipantId) return;

    // 4. Bầu chọn Tân Vương (Chỉ chạy khi không có ai đang thực hiện lock)
    if (!isPromoting.current) {
      const validCandidates = participants.filter(
        (p) => p.status === "approved" && presenceData[p.user_id],
      );

      if (!validCandidates.length) return;

      // Sắp xếp theo điểm quyền hạn và thời gian tham gia
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

      // 5. Nếu mình đứng đầu danh sách, thực hiện nghi thức "Đăng cơ"
      if (newKing?.user_id === myId) {
        isPromoting.current = true;

        const promoteSelf = async () => {
          // Lọc sẵn danh sách Host cũ (đã offline) cần dọn dẹp
          const ghostHostIds = participants
            .filter((p) => p.role === "host" && p.user_id !== myId)
            .map((h) => h.id);

          try {
            // Chỉ cần update role của mình. SQL Trigger "SECURITY DEFINER" sẽ tự động lo bảng rooms!
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

            // Hiển thị thông báo duy nhất (chặn trùng lặp bằng ID)
            toast.success("Bạn đã trở thành Chủ phòng mới!", {
              icon: "👑",
              id: SUCCESSION_TOAST_ID,
            });

            // Xóa record các Host cũ đã offline (Ghost Hosts)
            if (ghostHostIds.length > 0) {
              await supabase
                .from("watch_party_participants")
                .delete()
                .in("id", ghostHostIds);
            }

            refetch();
          } catch (error) {
            console.error("[HOST_SUCCESSION_ERROR]:", error);
            isPromoting.current = false;
            toast.error("Không thể tiếp quản vị trí Chủ phòng", {
              id: SUCCESSION_TOAST_ID,
            });
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
  ]);
}
