import { toast } from "sonner";
import { getWatchPartyStore } from "../index";
import { sendSystemMessage } from "./chat.actions";
import { mergeParticipantRealtimeRow } from "../participant-realtime";
import type { WatchPartyParticipant } from "@/types";

async function getResponseError(
  res: Response,
  fallbackMessage: string,
): Promise<Error> {
  try {
    const data = await res.json();
    const message = data?.error || data?.message || fallbackMessage;
    return new Error(message);
  } catch {
    return new Error(fallbackMessage);
  }
}

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

  const previousParticipants = state.participants;

  try {
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

    const res = await fetch("/api/watch-party/participant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: room.id, targetUserId, action }),
    });

    if (!res.ok) throw await getResponseError(res, "Thao tác thất bại");

    const data = (await res.json?.().catch(() => null)) as {
      participant?: WatchPartyParticipant;
      removedUserId?: string;
    } | null;

    if (data?.participant) {
      state.setParticipants(
        mergeParticipantRealtimeRow(
          getWatchPartyStore().participants,
          data.participant,
        ),
      );
    }

    if (action === "approve" || action === "kick") {
      sendSystemMessage(
        action === "approve"
          ? `✅ ${targetName || "Thành viên"} đã được duyệt vào phòng`
          : `🚫 ${targetName || "Thành viên"} đã bị trục xuất`,
      ).catch(() => {});
    }

    toast.success(
      action === "approve"
        ? "Đã duyệt"
        : action === "kick"
          ? "Đã trục xuất"
          : "Đã từ chối",
    );
  } catch (e) {
    state.setParticipants(previousParticipants);
    toast.error(e instanceof Error ? e.message : "Lỗi hệ thống");
    throw e;
  }
}

/**
 * Toggle participant permission
 */
export async function togglePermission(
  targetUserId: string,
  key: string,
  fallbackParticipant?: WatchPartyParticipant,
): Promise<void> {
  const state = getWatchPartyStore();
  const room = state.room;

  if (!room) {
    console.error("[togglePermission] Missing room");
    return;
  }

  const targetParticipant =
    state.participants.find((p) => p.user_id === targetUserId) ??
    fallbackParticipant;
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

  const previousParticipants = state.participants;

  let patchedParticipant = targetParticipant;

  // Optimistic update
  state.setParticipants(
    state.participants.map((p) => {
      if (p.user_id !== targetUserId) return p;

      if (key === "is_muted") {
        patchedParticipant = { ...p, is_muted: newValue };
        return patchedParticipant;
      } else if (key === "is_voice_muted") {
        patchedParticipant = { ...p, is_voice_muted: newValue };
        return patchedParticipant;
      } else {
        patchedParticipant = {
          ...p,
          permissions: {
            ...p.permissions,
            [key]: newValue,
          },
        };
        return patchedParticipant;
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
      throw await getResponseError(res, "Cập nhật quyền thất bại");
    }

    const data = (await res.json().catch(() => null)) as {
      participant?: WatchPartyParticipant;
    } | null;
    const confirmedParticipant = data?.participant ?? patchedParticipant;

    state.setParticipants(
      mergeParticipantRealtimeRow(
        getWatchPartyStore().participants,
        confirmedParticipant,
      ),
    );

    toast.success("Đã cập nhật quyền");
  } catch (error) {
    // Rollback on error
    state.setParticipants(previousParticipants);
    toast.error(error instanceof Error ? error.message : "Lỗi cập nhật quyền");
  }
}
