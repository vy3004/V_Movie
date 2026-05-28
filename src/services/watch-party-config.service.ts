import "server-only";

import { createSupabaseServer } from "@/lib/supabase/server";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { sanitizeHtml } from "@/lib/utils";
import { updateSettingsSchema } from "@/lib/validations/watch-party.validation";
import {
  WatchPartyPresenceService,
  WATCH_PARTY_PRESENCE_STALE_MS,
} from "@/services/watch-party-presence.service";
import type { RoomSettings } from "@/types/watch-party";

const getSearchCacheHash = (search: string) => {
  let hash = 0;
  const normalized = search.toLowerCase();

  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }

  return hash.toString(36);
};

/**
 * Watch Party Config Service
 * Handles settings, lobby, and voice token operations
 */
export const WatchPartyConfigService = {
  // ==================== SETTINGS ====================

  /**
   * Update room settings
   */
  updateSettings: async (params: {
    roomId: string;
    userId: string;
    title?: string;
    isPrivate?: boolean;
    maxParticipants?: number;
    isActive?: boolean;
    settings?: Partial<RoomSettings>;
  }) => {
    const supabase = await createSupabaseServer();

    logger.info("Updating room settings", {
      roomId: params.roomId,
      userId: params.userId,
    });

    // 1. Validate input với Zod
    const validationResult = updateSettingsSchema.safeParse({
      roomId: params.roomId,
      title: params.title,
      isPrivate: params.isPrivate,
      maxParticipants: params.maxParticipants,
      isActive: params.isActive,
      settings: params.settings,
    });

    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      logger.warn("Settings validation failed", {
        roomId: params.roomId,
        error: firstError.message,
      });
      throw new Error(firstError.message);
    }

    const validated = validationResult.data;

    // 2. Kiểm tra quyền (chỉ host)
    const { data: room, error: roomErr } = await supabase
      .from("watch_party_rooms")
      .select("host_id")
      .eq("id", params.roomId)
      .single();

    if (roomErr || !room) {
      logger.warn("Room not found for settings update", {
        roomId: params.roomId,
      });
      throw new Error("Phòng không tồn tại");
    }

    if (room.host_id !== params.userId) {
      logger.warn("Non-host attempted to update settings", {
        roomId: params.roomId,
        userId: params.userId,
      });
      throw new Error("Chỉ Chủ phòng mới được thay đổi cài đặt");
    }

    // 3. Sanitize và build safe updates
    const safeUpdates: Record<string, unknown> = {};

    if (validated.title !== undefined) {
      // Sanitize HTML để chống XSS
      const sanitizedTitle = sanitizeHtml(validated.title).trim();
      if (sanitizedTitle.length === 0) {
        throw new Error("Tiêu đề không được để trống sau khi làm sạch");
      }
      safeUpdates.title = sanitizedTitle;
    }

    if (validated.isPrivate !== undefined)
      safeUpdates.is_private = validated.isPrivate;

    if (validated.maxParticipants !== undefined)
      safeUpdates.max_participants = validated.maxParticipants;

    if (validated.isActive !== undefined)
      safeUpdates.is_active = validated.isActive;

    if (validated.settings !== undefined)
      safeUpdates.settings = validated.settings;

    if (Object.keys(safeUpdates).length === 0) {
      logger.debug("No valid fields to update", { roomId: params.roomId });
      return { success: true, message: "No valid fields to update" };
    }

    // 4. Update
    const { error: updateErr } = await supabase
      .from("watch_party_rooms")
      .update(safeUpdates)
      .eq("id", params.roomId)
      .eq("host_id", params.userId);

    if (updateErr) {
      logger.error("Failed to update settings", {
        roomId: params.roomId,
        error: updateErr.message,
      });
      throw updateErr;
    }

    logger.info("Settings updated successfully", {
      roomId: params.roomId,
      fields: Object.keys(safeUpdates),
    });

    return { success: true };
  },

  // ==================== LOBBY ====================

  /**
   * Invalidate all lobby cache keys
   */
  invalidateLobbyCache: async () => {
    if (!redis) return;

    try {
      // Get all cached lobby keys from tracking Set
      const keys = await redis.smembers("wp:lobby:cache_keys");

      if (keys.length > 0) {
        // Delete all lobby cache keys
        await redis.del(...keys);
        logger.debug("Invalidated lobby cache", { count: keys.length });
      }

      // Clear the tracking Set
      await redis.del("wp:lobby:cache_keys");
    } catch (error) {
      logger.error("Failed to invalidate lobby cache", { error });
    }
  },

  /**
   * Get list of active rooms (lobby)
   */
  getLobby: async (params: {
    search?: string;
    page?: number;
    limit?: number;
    sort?: "newest" | "most_viewers" | "most_slots";
  }) => {
    const supabase = await createSupabaseServer();

    const search = params.search?.trim() || "";
    const page = Math.max(0, params.page || 0);
    const limit = Math.min(100, Math.max(1, params.limit || 12));
    const sort = params.sort ?? "newest";
    const from = page * limit;
    const to = from + limit - 1;

    // Generate cache key: deterministic hash for edge-safe runtime compatibility
    const searchHash = search ? getSearchCacheHash(search) : "all";
    const leaseBucket = Math.floor(
      Date.now() / WATCH_PARTY_PRESENCE_STALE_MS,
    );
    const cacheKey = `wp:lobby:list:${page}:${searchHash}:${sort}:${leaseBucket}`;

    // Try cache first
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.debug("Lobby cache hit", { page, search, cacheKey });
          return cached;
        }
      } catch (error) {
        logger.warn("Redis cache read failed, falling back to DB", { error });
      }
    }

    logger.debug("Fetching lobby rooms from DB", { search, page, limit });

    let query = supabase
      .from("watch_party_rooms")
      .select(
        `
        id, room_code, title, current_movie_slug, current_episode_slug,
        is_private, created_at, movie_image, max_participants, participant_count,
        host:profiles!host_id(full_name, avatar_url)
      `,
      )
      .eq("is_active", true)
      .gt("participant_count", 0);

    if (search) {
      // Escape special characters for LIKE pattern
      const escapedSearch = search.replace(/[%_]/g, "\\$&");
      const searchPattern = `%${escapedSearch}%`;
      query = query.or(
        `room_code.ilike.${searchPattern},` +
          `and(is_private.eq.false,title.ilike.${searchPattern}),` +
          `and(is_private.eq.false,current_movie_slug.ilike.${searchPattern})`,
      );
    } else {
      query = query.eq("is_private", false);
    }

    if (sort === "most_viewers") {
      query = query
        .order("participant_count", { ascending: false })
        .order("created_at", { ascending: false });
    } else if (sort === "most_slots") {
      query = query
        .order("max_participants", { ascending: false })
        .order("created_at", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    const { data, error } = await query.range(from, to);

    if (error) {
      logger.error("Failed to fetch lobby rooms", { error: error.message });
      throw new Error("Lỗi tải phòng");
    }

    const rooms = data || [];

    let visibleRooms = rooms;
    const roomIds = rooms.map((room) => room.id);

    if (roomIds.length) {
      const activeLeaseByRoomId =
        await WatchPartyPresenceService.hasAnyActiveLeaseByRoomIds(roomIds);

      if (activeLeaseByRoomId) {
        visibleRooms = rooms.filter((room) => activeLeaseByRoomId[room.id] === true);
      }
    }

    const hasMoreRawPages = rooms.length === limit;
    const hasVisibleRooms = visibleRooms.length > 0;

    const result = {
      rooms: visibleRooms,
      nextPage: hasMoreRawPages && hasVisibleRooms ? page + 1 : null,
    };

    logger.info("Lobby rooms fetched", {
      count: visibleRooms.length,
      rawCount: rooms.length,
      page,
    });

    // Cache result for 60 seconds
    if (redis) {
      try {
        await redis.set(cacheKey, result, { ex: 60 });
        // Track this cache key in Set for invalidation
        await redis.sadd("wp:lobby:cache_keys", cacheKey);
        logger.debug("Lobby cached", { cacheKey });
      } catch (error) {
        logger.warn("Failed to cache lobby result", { error });
      }
    }

    return result;
  },
};
