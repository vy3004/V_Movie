import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Movie, PlaylistItem, WatchPartyRoom } from "@/types";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export function usePlaylistManager(room: WatchPartyRoom) {
  const queryClient = useQueryClient();
  const supabase = createSupabaseClient();

  // --- 1. REFS CHO KÉO THẢ ---
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // --- 2. FETCH DATA & REALTIME ---
  const { data: playlist = [] } = useQuery<PlaylistItem[]>({
    queryKey: ["wp-playlist", room.id],
    queryFn: () =>
      fetch(`/api/watch-party/playlist?roomId=${room.id}`).then((res) => {
        if (!res.ok) throw new Error("Failed to fetch playlist");
        return res.json();
      }),
  });

  useEffect(() => {
    const channel = supabase
      .channel(`wp_playlist_db_${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "watch_party_playlist",
          filter: `room_id=eq.${room.id}`,
        },
        (payload: RealtimePostgresChangesPayload<PlaylistItem>) => {
          queryClient.setQueryData<PlaylistItem[]>(
            ["wp-playlist", room.id],
            (old = []) => {
              if (payload.eventType === "INSERT" && payload.new) {
                if (old.some((item) => item.id === payload.new.id)) return old;
                return [...old, payload.new as PlaylistItem].sort(
                  (a, b) => a.sort_order - b.sort_order,
                );
              }
              if (payload.eventType === "DELETE" && payload.old) {
                return old.filter((item) => item.id !== payload.old.id);
              }
              if (payload.eventType === "UPDATE" && payload.new) {
                return old
                  .map((item) =>
                    item.id === payload.new.id
                      ? { ...item, ...(payload.new as PlaylistItem) }
                      : item,
                  )
                  .sort((a, b) => a.sort_order - b.sort_order);
              }
              return old;
            },
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [room.id, queryClient, supabase]);

  // --- 3. API HANDLERS ---
  const handleAddMovie = async (movie: Movie, onSuccess: () => void) => {
    // Kiểm tra tồn tại trước khi so sánh, dùng trim() và toLowerCase() để chính xác tuyệt đối
    const selectedSlug = movie.slug?.trim().toLowerCase();
    const currentPlayingSlug = room?.current_movie_slug?.trim().toLowerCase();
    if (
      selectedSlug &&
      currentPlayingSlug &&
      selectedSlug === currentPlayingSlug
    ) {
      return toast.error(
        "Phim này đang được chiếu rồi, chọn phim khác nha bạn ơi!",
        {
          id: "duplicate-playing",
        },
      );
    }
    const isAlreadyInPlaylist = playlist.some(
      (item) => item.movie_slug === movie.slug,
    );
    if (isAlreadyInPlaylist) {
      return toast.error("Phim này đã có trong danh sách chờ rồi bạn ơi!");
    }

    const firstEpisodeSlug =
      movie.episodes?.[0]?.server_data?.[0]?.slug ||
      (movie.type === "single" ? "full" : "tap-1");
    const res = await fetch("/api/watch-party/playlist", {
      method: "POST",
      body: JSON.stringify({
        roomId: room.id,
        movieSlug: movie.slug,
        movieName: movie.name,
        thumbUrl: movie.thumb_url || movie.poster_url,
        episodeSlug: firstEpisodeSlug,
      }),
    });
    if (res.ok) {
      toast.success("Đã thêm vào danh sách chờ");
      onSuccess(); // Chạy hàm đóng menu
    }
  };

  const handlePlayNow = async (item: PlaylistItem) => {
    try {
      const { error } = await supabase
        .from("watch_party_rooms")
        .update({
          current_movie_slug: item.movie_slug,
          current_episode_slug: item.episode_slug,
          movie_image: item.thumb_url,
        })
        .eq("id", room.id);

      if (error) throw error;
      toast.success(`Đang chuyển sang: ${item.movie_name}`);
      await fetch(`/api/watch-party/playlist?id=${item.id}`, {
        method: "DELETE",
      });

      supabase.channel(`wp_ui_${room.id}`).send({
        type: "broadcast",
        event: "change_episode_sync",
        payload: { slug: item.episode_slug },
      });
      supabase.channel(`wp_ui_${room.id}`).send({
        type: "broadcast",
        event: "chat",
        payload: {
          id: crypto.randomUUID(),
          user_id: "system",
          message: `🎬 Đã chuyển sang phim: ${item.movie_name}`,
          created_at: new Date().toISOString(),
          is_system: true,
        },
      });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Đã có lỗi xảy ra";
      toast.error("Không thể chuyển phim: " + errorMessage);
    }
  };

  const handleDeleteItem = async (id: string) => {
    await fetch(`/api/watch-party/playlist?id=${id}`, { method: "DELETE" });
  };

  // --- 4. DRAG & DROP HANDLERS ---
  const handleDragStart = (e: React.DragEvent, index: number) => {
    dragItem.current = index;
    if (e.currentTarget instanceof HTMLElement)
      e.currentTarget.style.opacity = "0.5";
  };

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = async (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement)
      e.currentTarget.style.opacity = "1";
    if (
      dragItem.current !== null &&
      dragOverItem.current !== null &&
      dragItem.current !== dragOverItem.current
    ) {
      const newPlaylist = [...playlist];
      const draggedItem = newPlaylist[dragItem.current];
      newPlaylist.splice(dragItem.current, 1);
      newPlaylist.splice(dragOverItem.current, 0, draggedItem);

      queryClient.setQueryData(["wp-playlist", room.id], newPlaylist);
      try {
        await Promise.all(
          newPlaylist.map((item, index) =>
            supabase
              .from("watch_party_playlist")
              .update({ sort_order: index })
              .eq("id", item.id),
          ),
        );
      } catch {
        toast.error("Không thể lưu thứ tự mới!");
        queryClient.invalidateQueries({ queryKey: ["wp-playlist", room.id] });
      }
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  return {
    playlist,
    handleAddMovie,
    handlePlayNow,
    handleDeleteItem,
    handleDragStart,
    handleDragEnter,
    handleDragEnd,
  };
}
