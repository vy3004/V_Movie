import { toast } from "sonner";
import { getWatchPartyStore } from "../index";
import { sendSystemMessage } from "./chat.actions";

/**
 * Handle participant actions: approve, reject, kick
 */
export async function handleParticipantAction(
  targetUserId: string,
  action: "approve" | "reject" | "kick",
  targetName?: string,
): Promise<void> {
  const state = getWatchPartyStore();
  const room = state.room;
  const myUserId = state.user?.id;

  if (!room) {
    console.error("[handleParticipantAction] Missing room");
    return;
  }

  // CRITICAL: Check if we're kicking ourselves BEFORE making API call
  const isKickingSelf = action === "kick" && targetUserId === myUserId;

  if (isKickingSelf) {
    console.warn("[handleParticipantAction] Cannot kick yourself");
    toast.error("Không thể tự kick chính mình");
    return;
  }

  try {
    const res = await fetch("/api/watch-party/participant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: room.id, targetUserId, action }),
    });

    if (!res.ok) throw new Error("Thao tác thất bại");

    // Optimistic update
    if (action === "approve") {
      state.setParticipants(
        state.participants.map((p) =>
          p.user_id === targetUserId ? { ...p, status: "approved" } : p,
        ),
      );
    } else {
      // Remove participant for reject/kick
      state.setParticipants(
        state.participants.filter((p) => p.user_id !== targetUserId),
      );
    }

    // Send system message
    if (action === "approve") {
      await sendSystemMessage(
        `✅ ${targetName || "Thành viên"} đã được duyệt vào phòng`,
      );
    } else if (action === "kick") {
      await sendSystemMessage(
        `🚫 ${targetName || "Thành viên"} đã bị trục xuất`,
      );
    }

    toast.success(
      action === "approve"
        ? "Đã duyệt"
        : action === "kick"
          ? "Đã trục xuất"
          : "Đã từ chối",
    );
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Lỗi hệ thống");
  }
}

/**
 * Toggle participant permission
 */
export async function togglePermission(
  targetUserId: string,
  key: string,
): Promise<void> {
  const state = getWatchPartyStore();
  const room = state.room;

  if (!room) {
    console.error("[togglePermission] Missing room");
    return;
  }

  // Find target participant to get current state
  const targetParticipant = state.participants.find(
    (p) => p.user_id === targetUserId,
  );
  if (!targetParticipant) {
    toast.error("Không tìm thấy thành viên");
    return;
  }

  // Calculate new value based on permission key
  let newValue: boolean;
  if (key === "is_muted" || key === "is_voice_muted") {
    newValue = !targetParticipant[key as keyof typeof targetParticipant];
  } else {
    newValue =
      !targetParticipant.permissions?.[
        key as keyof typeof targetParticipant.permissions
      ];
  }

  // Optimistic update
  state.setParticipants(
    state.participants.map((p) => {
      if (p.user_id !== targetUserId) return p;

      if (key === "is_muted") {
        return { ...p, is_muted: newValue };
      } else if (key === "is_voice_muted") {
        return { ...p, is_voice_muted: newValue };
      } else {
        return {
          ...p,
          permissions: {
            ...p.permissions,
            [key]: newValue,
          },
        };
      }
    }),
  );

  try {
    const res = await fetch("/api/watch-party/participant/permissions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: room.id,
        targetUserId,
        permissionKey: key,
      }),
    });

    if (!res.ok) {
      throw new Error("Cập nhật quyền thất bại");
    }

    // Success - postgres trigger will broadcast UPDATE event to other clients
    toast.success("Đã cập nhật quyền");
  } catch (error) {
    // Rollback on error
    state.setParticipants(
      state.participants.map((p) => {
        if (p.user_id !== targetUserId) return p;

        if (key === "is_muted") {
          return { ...p, is_muted: !newValue };
        } else if (key === "is_voice_muted") {
          return { ...p, is_voice_muted: !newValue };
        } else {
          return {
            ...p,
            permissions: {
              ...p.permissions,
              [key]: !newValue,
            },
          };
        }
      }),
    );
    toast.error(error instanceof Error ? error.message : "Lỗi cập nhật quyền");
  }
}
