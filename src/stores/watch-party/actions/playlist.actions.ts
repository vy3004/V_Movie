import { toast } from "sonner";
import { debounce } from "lodash-es";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Movie, PlaylistItem } from "@/types";
import { useWatchPartyStore } from "../index";

/**
 * Debounced function to save playlist order to database
 * Prevents spam API calls when user drags multiple times
 */
const debouncedSavePlaylistOrder = debounce(
  async (items: { id: string; sort_order: number }[]) => {
    try {
      const supabase = createSupabaseClient();
      const { error } = await supabase.rpc("update_playlist_order", { items });

      if (error) {
        throw new Error("Không thể cập nhật thứ tự");
      }
    } catch (error) {
      console.error("[Playlist] Failed to save order:", error);
      toast.error("Không thể lưu thứ tự mới!");
    }
  },
  1000,
  { leading: false, trailing: true },
);

/**
 * Add movie to playlist
 */
export async function addMovieToPlaylist(
  movie: Movie,
  roomId: string,
  currentMovieSlug: string,
  onSuccess?: () => void,
) {
  const store = useWatchPartyStore.getState();
  const playlist = store.playlist;

  // Check if movie is currently playing
  const selectedSlug = movie.slug?.trim().toLowerCase();
  const currentPlayingSlug = currentMovieSlug?.trim().toLowerCase();

  if (
    selectedSlug &&
    currentPlayingSlug &&
    selectedSlug === currentPlayingSlug
  ) {
    return toast.error(
      "Phim này đang được chiếu rồi, chọn phim khác nha bạn ơi!",
      { id: "duplicate-playing" },
    );
  }

  // Check if already in playlist
  const isAlreadyInPlaylist = playlist.some(
    (item) =>
      item.movie_slug?.trim().toLowerCase() ===
      movie.slug?.trim().toLowerCase(),
  );

  if (isAlreadyInPlaylist) {
    return toast.error("Phim này đã có trong danh sách chờ rồi bạn ơi!");
  }

  // Get first episode slug
  const firstEpisodeSlug =
    movie.episodes?.[0]?.server_data?.[0]?.slug ||
    (movie.type === "single" ? "full" : "tap-1");

  try {
    const res = await fetch("/api/watch-party/playlist", {
      method: "POST",
      body: JSON.stringify({
        roomId,
        movieSlug: movie.slug,
        movieName: movie.name,
        thumbUrl: movie.thumb_url || movie.poster_url,
        episodeSlug: firstEpisodeSlug,
      }),
    });

    if (res.ok) {
      toast.success("Đã thêm vào danh sách chờ");
      onSuccess?.();
    } else {
      toast.error("Không thể thêm phim vào danh sách");
    }
  } catch {
    toast.error("Lỗi kết nối, vui lòng thử lại");
  }
}

/**
 * Play playlist item now
 */
export async function playPlaylistItemNow(
  item: PlaylistItem,
  roomId: string,
  userName: string,
  sendSystemMessage?: (text: string) => Promise<void>,
) {
  const store = useWatchPartyStore.getState();
  const supabase = createSupabaseClient();
  const prevRoom = store.room; // Save for rollback

  try {
    // Optimistic update - update UI immediately for instant feedback
    store.updateRoom({
      current_movie_slug: item.movie_slug,
      current_episode_slug: item.episode_slug,
      movie_image: item.thumb_url,
    });
    // Reset player to 0
    store.updatePlayerState(0, true);

    const { error } = await supabase
      .from("watch_party_rooms")
      .update({
        current_movie_slug: item.movie_slug,
        current_episode_slug: item.episode_slug,
        movie_image: item.thumb_url,
      })
      .eq("id", roomId);

    if (error) throw error;

    toast.success(`Đang chuyển sang: ${item.movie_name}`);

    // Delete from playlist
    const deleteRes = await fetch(`/api/watch-party/playlist?id=${item.id}`, {
      method: "DELETE",
    });

    if (!deleteRes.ok) {
      console.warn("Failed to delete playlist item after playing");
    }

    // Broadcast episode change
    await supabase.channel(`wp_data_${roomId}`).send({
      type: "broadcast",
      event: "change_episode_sync",
      payload: {
        slug: item.episode_slug,
        movie_slug: item.movie_slug,
        movie_image: item.thumb_url,
      },
    });

    // Vì ta update từ Client, ta cần chọc nhẹ 1 API ngầm để Server update Redis Lobby
    // Gọi "ké" API sync để Server biết mà đổi ảnh
    fetch("/api/watch-party/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId,
        status: "play",
        time: 0,
        episodeSlug: item.episode_slug,
      }),
    }).catch(() => {});

    // Send system message
    if (sendSystemMessage) {
      await sendSystemMessage(
        `🍿 ${userName} đã phát phim: ${item.movie_name}`,
      );
    }
  } catch (err: unknown) {
    // Rollback on error
    if (prevRoom) store.setRoom(prevRoom);
    const errorMessage =
      err instanceof Error ? err.message : "Đã có lỗi xảy ra";
    toast.error("Không thể chuyển phim: " + errorMessage);
  }
}

/**
 * Delete playlist item
 */
export async function deletePlaylistItem(id: string) {
  try {
    const res = await fetch(`/api/watch-party/playlist?id=${id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      toast.error("Không thể xóa khỏi danh sách");
    }
  } catch {
    toast.error("Lỗi kết nối, vui lòng thử lại");
  }
}

/**
 * Reorder playlist via drag & drop
 * Uses optimistic update + debounced API call
 */
export async function reorderPlaylist(fromIndex: number, toIndex: number) {
  const store = useWatchPartyStore.getState();
  const playlist = store.playlist;

  if (fromIndex >= playlist.length || toIndex >= playlist.length) {
    return;
  }

  // Optimistic update - update UI immediately
  store.reorderPlaylist(fromIndex, toIndex);

  // Calculate new order
  const newPlaylist = [...playlist];
  const [draggedItem] = newPlaylist.splice(fromIndex, 1);
  newPlaylist.splice(toIndex, 0, draggedItem);

  // Prepare items for API
  const items = newPlaylist.map((item, index) => ({
    id: item.id,
    sort_order: index,
  }));

  // Save to database with debounce (prevents spam on multiple drags)
  debouncedSavePlaylistOrder(items);
}
