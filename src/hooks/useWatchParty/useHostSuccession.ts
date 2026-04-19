import { useEffect, useRef } from "react";
import { WatchPartyParticipant } from "@/types/watch-party";
import { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";

export function useHostSuccession(
  participants: WatchPartyParticipant[],
  myId: string,
  myParticipantId: string | undefined,
  supabase: SupabaseClient,
  refetch: () => void,
) {
  // THÊM: Khóa chống chạy lại logic trong lúc chờ DB cập nhật
  const isPromoting = useRef(false);

  useEffect(() => {
    // Reset lại cờ khóa nếu phòng đã có Host
    const currentHost = participants.find((p) => p.role === "host");
    if (currentHost) {
      isPromoting.current = false;
      return;
    }

    if (!participants.length || !myParticipantId) return;

    // Lúc này phòng ĐANG MẤT HOST và chưa ai gọi API promote
    if (!currentHost && !isPromoting.current) {
      // 1. FIX LỖI "KẺ LẠ MẶT": Chỉ những người đã được duyệt (approved) mới được kế thừa
      const validCandidates = participants.filter(
        (p) => p.status === "approved",
      );

      if (!validCandidates.length) return; // Nếu phòng toàn người đang pending thì bỏ qua

      // 2. Chấm điểm tìm Vua mới
      const survivors = [...validCandidates].sort((a, b) => {
        const scoreA =
          (a.permissions?.can_manage_users ? 2 : 0) +
          (a.permissions?.can_control_media ? 1 : 0);
        const scoreB =
          (b.permissions?.can_manage_users ? 2 : 0) +
          (b.permissions?.can_control_media ? 1 : 0);

        if (scoreA !== scoreB) return scoreB - scoreA;

        // Nếu bằng điểm, ai vào phòng sớm nhất sẽ làm Vua
        return (
          new Date(a.created_at || 0).getTime() -
          new Date(b.created_at || 0).getTime()
        );
      });

      // 3. Máy của người được chọn sẽ thực hiện nghi lễ đăng cơ
      if (survivors[0]?.user_id === myId) {
        // Đóng khóa lại ngay lập tức để không chạy 2 lần
        isPromoting.current = true;

        toast.success("Bạn đã trở thành Chủ phòng mới!", { icon: "👑" });

        // FIX TS LỖI PROMISELIKE: Xử lý error bên trong then()
        supabase
          .from("watch_party_participants")
          .update({ role: "host" })
          .eq("id", myParticipantId)
          .then(({ error }) => {
            if (error) {
              console.error("Lỗi khi phong Vua:", error);
              isPromoting.current = false; // Mở khóa nếu bị lỗi mạng hoặc lỗi DB
            } else {
              refetch(); // Nếu không có lỗi thì refetch thành công
            }
          });
      }
    }
  }, [participants, myId, myParticipantId, supabase, refetch]);
}
