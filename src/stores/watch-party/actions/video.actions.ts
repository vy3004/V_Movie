import { toast } from "sonner";
import { throttle, debounce } from "lodash-es";
import { RealtimeChannel } from "@supabase/supabase-js";
import { createSupabaseClient } from "@/lib/supabase/client";
import { getWatchPartyStore } from "../index";
import { sendSystemMessage } from "./chat.actions";

/**
 * Throttled broadcast function to prevent spam
 * Max 3-4 times per second (300ms throttle)
 */
const throttledBroadcast = throttle(
  (
    mediaChannel: RealtimeChannel,
    payload: { action: string; time: number; slug?: string; senderId: string },
  ) => {
    if (mediaChannel && mediaChannel.state === "joined") {
      mediaChannel
        .send({
          type: "broadcast",
          event: "video_control",
          payload,
        })
        .catch((err: Error) => {
          console.error("[sendControl] Broadcast error:", err);
        });
    }
  },
  300,
  { leading: true, trailing: true },
);

/**
 * Debounced API call to persist playback state to database
 * Prevents excessive API calls while still ensuring state is saved
 */
const debouncedSyncAPI = debounce(
  async (
    roomId: string,
    action: "play" | "pause" | "seek",
    time: number,
    episodeSlug?: string,
  ) => {
    try {
      await fetch("/api/watch-party/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          status: action === "seek" ? undefined : action,
          time,
          episodeSlug,
        }),
      });
    } catch (error) {
      console.error("[SyncAPI] Failed to persist state:", error);
    }
  },
  1000,
  { leading: false, trailing: true },
);

/**
 * Send control command (play/pause/seek) to other participants
 * Uses mediaChannel from store (high-frequency channel)
 * Throttled to prevent spam
 */
export function sendControl(
  action: "play" | "pause" | "seek",
  time: number,
  slug?: string,
): void {
  const state = getWatchPartyStore();
  const room = state.room;
  const user = state.user;
  const mediaChannel = state.mediaChannel;
  const canControl =
    state.participants.find((p) => p.user_id === user?.id)?.permissions
      ?.can_control_media ||
    state.participants.find((p) => p.user_id === user?.id)?.role === "host";

  console.log("[sendControl] Called:", {
    action,
    time,
    slug,
    hasRoom: !!room,
    hasUser: !!user,
    canControl,
    channelState: mediaChannel?.state,
  });

  if (!room || !user || !canControl) {
    console.warn("[sendControl] Missing room, user, or permission");
    return;
  }

  if (!mediaChannel || mediaChannel.state !== "joined") {
    console.warn("[sendControl] Media channel not ready", {
      hasChannel: !!mediaChannel,
      state: mediaChannel?.state,
    });
    return;
  }

  // Use throttled broadcast to prevent spam
  const payload = { action, time, slug, senderId: user.id, sentAt: Date.now() };
  console.log("[sendControl] Broadcasting:", payload);
  throttledBroadcast(mediaChannel, payload);

  // Persist state to database (debounced to prevent excessive API calls)
  debouncedSyncAPI(room.id, action, time, slug);
}

/**
 * Send heartbeat to sync current playback state
 * Uses mediaChannel for high-frequency updates
 */
export function sendHeartbeat(time: number, isPaused: boolean): void {
  const state = getWatchPartyStore();
  const room = state.room;
  const user = state.user;
  const mediaChannel = state.mediaChannel;

  if (!room || !user) {
    return;
  }

  if (!mediaChannel || mediaChannel.state !== "joined") {
    return;
  }

  // Send via media channel (high frequency channel)
  mediaChannel.send({
    type: "broadcast",
    event: "heartbeat_sync",
    payload: {
      time,
      isPaused,
      senderId: user.id,
      sentAt: Date.now(),
    },
  });
}

/**
 * Handle episode selection
 * Note: change_episode_sync is sent via data channel (not media channel)
 * because it's a low-frequency event that needs to be reliable
 */
export async function handleSelectEpisode(
  slug: string,
  name?: string,
): Promise<void> {
  const state = getWatchPartyStore();
  const room = state.room;
  const user = state.user;
  const isHost =
    state.participants.find((p) => p.user_id === user?.id)?.role === "host";
  const canControl =
    state.participants.find((p) => p.user_id === user?.id)?.permissions
      ?.can_control_media || isHost;

  if (!room || !user) {
    console.error("[handleSelectEpisode] Missing room or user");
    return;
  }

  if (!canControl) {
    toast.error("Bạn không có quyền đổi tập phim");
    return;
  }

  const originalSlug = room.current_episode_slug;

  // Optimistic update
  state.updateRoom({ current_episode_slug: slug });

  const supabase = createSupabaseClient();

  if (isHost) {
    const { error } = await supabase
      .from("watch_party_rooms")
      .update({ current_episode_slug: slug })
      .eq("id", room.id);

    if (error) {
      console.error("Failed to update room episode:", error);
      // Rollback
      state.updateRoom({ current_episode_slug: originalSlug });
      toast.error("Lỗi đồng bộ với máy chủ!");
      return;
    }
  }

  // Broadcast via data channel for immediate sync (don't wait for postgres trigger)
  await supabase
    .channel(`wp_data_${room.id}`)
    .send({
      type: "broadcast",
      event: "change_episode_sync",
      payload: { slug },
    })
    .catch(() => {});

  await sendSystemMessage(
    `🎬 ${(user && "full_name" in user ? user.full_name : user?.user_metadata?.full_name) || "Thành viên"} đã chuyển sang ${name || "tập mới"}`,
  );
}

/**
 * 👑 NÚT THOÁT HIỂM: Ép đồng bộ thủ công khi có sự cố mạng
 */
export function requestManualSync(): void {
  const state = getWatchPartyStore();
  const room = state.room;
  const user = state.user;
  const mediaChannel = state.mediaChannel;
  const playerSyncRef = state.playerSyncRef;
  const participants = state.participants;

  if (!room || !user) {
    toast.error("Không thể đồng bộ lúc này");
    return;
  }

  if (!mediaChannel || mediaChannel.state !== "joined") {
    toast.error("Đang kết nối lại máy chủ...");
    return;
  }

  const isHost =
    participants.find((p) => p.user_id === user.id)?.role === "host";

  if (isHost) {
    // HOST: Lấy tọa độ hiện tại của Host và ÉP mọi người đồng bộ theo
    const playerState = playerSyncRef?.getCurrentState?.();
    if (playerState) {
      mediaChannel
        .send({
          type: "broadcast",
          event: "video_control",
          payload: {
            action: playerState.isPaused ? "pause" : "play",
            time: playerState.time,
            senderId: user.id,
            sentAt: Date.now(),
          },
        })
        .catch(() => {});
      toast.success("Đã gửi lệnh đồng bộ tới mọi người!");
    }
  } else {
    // GUEST: Xin Host gửi lại tọa độ mới nhất
    mediaChannel
      .send({
        type: "broadcast",
        event: "request_sync_from_host",
        payload: {},
      })
      .catch(() => {});
    toast.success("Đã yêu cầu máy chủ đồng bộ lại!");
  }
}
