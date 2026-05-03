import "server-only";

import { createSupabaseServer } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { sanitizeHtml } from "@/lib/utils";
import { addToPlaylistSchema } from "@/lib/validations/watch-party.validation";
import type {
  ParticipantPermissions,
  PlaylistItem,
  ChatMessage,
} from "@/types/watch-party";

/**
 * Watch Party Content Service
 * Handles playlist and messages operations
 */
export const WatchPartyContentService = {
  // ==================== PLAYLIST ====================

  /**
   * Lấy playlist
   */
  getPlaylist: async (roomId: string) => {
    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from("watch_party_playlist")
      .select(
        `
        *,
        profiles:added_by(full_name, avatar_url)
      `,
      )
      .eq("room_id", roomId)
      .order("sort_order", { ascending: true });

    if (error) throw error;

    return data as PlaylistItem[];
  },

  /**
   * Thêm vào playlist
   */
  addToPlaylist: async (params: {
    roomId: string;
    userId: string;
    movieSlug: string;
    movieName: string;
    episodeSlug: string;
    thumbUrl: string;
  }) => {
    const supabase = await createSupabaseServer();

    logger.info("Adding to playlist", {
      roomId: params.roomId,
      userId: params.userId,
      movieSlug: params.movieSlug,
      episodeSlug: params.episodeSlug,
    });

    // 1. Validate input với Zod
    const validationResult = addToPlaylistSchema.safeParse(params);

    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      logger.warn("Add to playlist validation failed", {
        roomId: params.roomId?.substring(0, 50),
        error: firstError.message,
      });
      throw new Error(firstError.message);
    }

    const validated = validationResult.data;

    // 2. Kiểm tra quyền
    const { data: participant } = await supabase
      .from("watch_party_participants")
      .select("role, permissions")
      .eq("room_id", validated.roomId)
      .eq("user_id", params.userId)
      .eq("status", "approved")
      .single();

    if (!participant) {
      logger.warn("User not in room", {
        roomId: validated.roomId,
        userId: params.userId,
      });
      throw new Error("Bạn không có trong phòng này");
    }

    const permissions = participant.permissions as ParticipantPermissions;
    if (participant.role !== "host" && !permissions?.can_control_media) {
      logger.warn("User lacks permission to add to playlist", {
        roomId: validated.roomId,
        userId: params.userId,
      });
      throw new Error("Bạn không có quyền thêm phim vào hàng đợi");
    }

    // 3. Kiểm tra trùng lặp
    const { data: existing } = await supabase
      .from("watch_party_playlist")
      .select("id")
      .eq("room_id", validated.roomId)
      .eq("movie_slug", validated.movieSlug)
      .eq("episode_slug", validated.episodeSlug)
      .maybeSingle();

    if (existing) {
      logger.warn("Duplicate playlist item", {
        roomId: validated.roomId,
        movieSlug: validated.movieSlug,
        episodeSlug: validated.episodeSlug,
      });
      throw new Error("Phim này đã có trong danh sách chờ");
    }

    // 4. Lấy sort_order
    const { data: lastItem } = await supabase
      .from("watch_party_playlist")
      .select("sort_order")
      .eq("room_id", validated.roomId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = (lastItem?.sort_order ?? -1) + 1;

    // 5. Sanitize movieName để chống XSS
    const sanitizedMovieName = sanitizeHtml(validated.movieName);

    // 6. Insert
    const { data, error } = await supabase
      .from("watch_party_playlist")
      .insert({
        room_id: validated.roomId,
        movie_slug: validated.movieSlug,
        movie_name: sanitizedMovieName,
        episode_slug: validated.episodeSlug,
        thumb_url: validated.thumbUrl,
        sort_order: nextOrder,
        added_by: params.userId,
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to add to playlist", {
        roomId: validated.roomId,
        error: error.message,
      });
      throw error;
    }

    logger.info("Added to playlist successfully", {
      roomId: validated.roomId,
      playlistId: data.id,
    });

    return data;
  },

  /**
   * Xóa khỏi playlist
   */
  removeFromPlaylist: async (playlistId: string, userId: string) => {
    const supabase = await createSupabaseServer();

    logger.info("Removing from playlist", { playlistId, userId });

    // 1. Lấy room_id
    const { data: playlistItem } = await supabase
      .from("watch_party_playlist")
      .select("room_id")
      .eq("id", playlistId)
      .single();

    if (!playlistItem) {
      logger.warn("Playlist item not found", { playlistId });
      throw new Error("Item không tồn tại");
    }

    // 2. Kiểm tra quyền
    const { data: caller } = await supabase
      .from("watch_party_participants")
      .select("role, permissions")
      .eq("room_id", playlistItem.room_id)
      .eq("user_id", userId)
      .eq("status", "approved")
      .single();

    const permissions = caller?.permissions as ParticipantPermissions;

    if (
      !caller ||
      (caller.role !== "host" && !permissions?.can_control_media)
    ) {
      logger.warn("User lacks permission to remove from playlist", {
        playlistId,
        userId,
      });
      throw new Error("Bạn không có quyền xoá phim khỏi Playlist");
    }

    // 3. Xóa
    const { error } = await supabase
      .from("watch_party_playlist")
      .delete()
      .eq("id", playlistId);

    if (error) {
      logger.error("Failed to remove from playlist", {
        playlistId,
        error: error.message,
      });
      throw error;
    }

    logger.info("Removed from playlist successfully", { playlistId });

    return { success: true };
  },

  // ==================== MESSAGES ====================

  /**
   * Lấy messages
   */
  getMessages: async (roomId: string, userId: string) => {
    const supabase = await createSupabaseServer();

    logger.debug("Fetching messages", { roomId, userId });

    // Kiểm tra user có phải thành viên không
    const { data: participant } = await supabase
      .from("watch_party_participants")
      .select("id")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .eq("status", "approved")
      .single();

    if (!participant) {
      logger.warn("Non-participant attempted to fetch messages", {
        roomId,
        userId,
      });
      throw new Error("Bạn không phải thành viên phòng");
    }

    // Lấy 50 tin nhắn gần nhất
    const { data: messages, error } = await supabase
      .from("watch_party_messages")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      logger.error("Failed to fetch messages", {
        roomId,
        error: error.message,
      });
      throw error;
    }

    logger.debug("Messages fetched", { roomId, count: messages?.length || 0 });

    return (messages?.reverse() ?? []) as ChatMessage[];
  },

  /**
   * Gửi message
   */
  sendMessage: async (params: {
    id: string;
    roomId: string;
    userId: string;
    userName: string;
    avatarUrl: string;
    text: string;
    type: "chat" | "system";
    metadata?: Record<string, unknown>;
  }) => {
    const supabase = await createSupabaseServer();

    logger.debug("Sending message", {
      roomId: params.roomId,
      userId: params.userId,
      type: params.type,
    });

    // 1. Lấy quyền và settings
    const [{ data: participant }, { data: roomInfo }] = await Promise.all([
      supabase
        .from("watch_party_participants")
        .select("role, is_muted, permissions")
        .eq("room_id", params.roomId)
        .eq("user_id", params.userId)
        .eq("status", "approved")
        .single(),
      supabase
        .from("watch_party_rooms")
        .select("settings")
        .eq("id", params.roomId)
        .single(),
    ]);

    if (!participant) {
      logger.warn("Non-participant attempted to send message", {
        roomId: params.roomId,
        userId: params.userId,
      });
      throw new Error("Chưa tham gia phòng");
    }

    if (!roomInfo) {
      logger.warn("Room not found for message", { roomId: params.roomId });
      throw new Error("Phòng không tồn tại");
    }

    const isHost = participant.role === "host";
    const isMod = !!participant.permissions?.can_manage_users;

    // 2. Kiểm tra quyền gửi
    if (params.type === "chat") {
      if (participant.is_muted) {
        logger.warn("Muted user attempted to send message", {
          roomId: params.roomId,
          userId: params.userId,
        });
        throw new Error("Bạn bị cấm chat");
      }
      const guestCanChat = roomInfo?.settings?.guest_can_chat ?? true;
      if (!isHost && !isMod && !guestCanChat) {
        logger.warn("Guest attempted to chat in disabled room", {
          roomId: params.roomId,
          userId: params.userId,
        });
        throw new Error("Phòng đã tắt chat");
      }
    } else if (params.type === "system") {
      if (!isHost && !isMod) {
        logger.warn("Non-moderator attempted to send system message", {
          roomId: params.roomId,
          userId: params.userId,
        });
        throw new Error("Không có quyền gửi tin hệ thống");
      }
    }

    // 3. Insert message
    const { data: message, error } = await supabase
      .from("watch_party_messages")
      .insert({
        id: params.id,
        room_id: params.roomId,
        user_id: params.userId,
        user_name: params.userName,
        avatar_url: params.avatarUrl,
        text: params.text,
        type: params.type,
        metadata: params.metadata,
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to send message", {
        roomId: params.roomId,
        error: error.message,
      });
      throw error;
    }

    logger.info("Message sent successfully", {
      roomId: params.roomId,
      messageId: message.id,
      type: params.type,
    });

    return message as ChatMessage;
  },
};
