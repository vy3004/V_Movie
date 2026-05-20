import { toast } from "sonner";
import { getWatchPartyStore } from "../index";
import { sendSystemMessage } from "./chat.actions";
import { createSupabaseClient } from "@/lib/supabase/client";

/**
 * Handle episode selection (change episode)
 */
export async function handleSelectEpisode(
  slug: string,
  episodeName?: string,
): Promise<void> {
  const state = getWatchPartyStore();
  const room = state.room;
  const user = state.user;

  if (!room || !user) {
    console.error("[handleSelectEpisode] Missing room or user");
    return;
  }

  const supabase = createSupabaseClient();
  const prevRoom = { ...room }; // Save for rollback

  try {
    // Optimistic update
    state.updateRoom({ current_episode_slug: slug });

    // Update database
    const { error } = await supabase
      .from("watch_party_rooms")
      .update({ current_episode_slug: slug })
      .eq("id", room.id);

    if (error) throw error;

    // Broadcast episode change through existing data channel
    await state.dataChannel?.send({
      type: "broadcast",
      event: "change_episode_sync",
      payload: { slug },
    }).catch(() => {});

    // Sync to Redis
    fetch("/api/watch-party/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: room.id,
        status: "play",
        time: 0,
        episodeSlug: slug,
      }),
    }).catch(() => {});

    // Send system message
    const userName =
      ("full_name" in user ? user.full_name : user.user_metadata?.full_name) ||
      "Thành viên";
    await sendSystemMessage(
      `🎬 ${userName} đã chuyển sang: ${episodeName || slug}`,
    );

    toast.success(`Đã chuyển sang: ${episodeName || slug}`);
  } catch (err: unknown) {
    // Rollback on error
    state.setRoom(prevRoom);
    const errorMessage =
      err instanceof Error ? err.message : "Đã có lỗi xảy ra";
    toast.error("Không thể chuyển tập: " + errorMessage);
  }
}
