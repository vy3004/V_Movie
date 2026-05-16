import "server-only";

import { createSupabaseServer } from "@/lib/supabase/server";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { WatchPartyConfigService } from "@/services/watch-party-config.service";
import {
  joinRoomSchema,
  leaveRoomSchema,
  participantActionSchema,
} from "@/lib/validations/watch-party.validation";
import {
  RoomNotFoundError,
  RoomClosedError,
  RoomFullError,
  NotHostError,
  BadRequestError,
  ForbiddenError,
  NoPermissionError,
  NotFoundError,
} from "@/lib/errors/watch-party-errors";
import type {
  WatchPartyVideoState,
  ParticipantPermissions,
  RoomSettings,
} from "@/types/watch-party";

const REDIS_STATE_TTL = 86400; // 24h

/**
 * Watch Party Service
 * Centralized business logic for watch party feature
 */
export const WatchPartyService = {
  // ==================== ROOM MANAGEMENT ====================

  /**
   * Tạo phòng mới
   */
  createRoom: async (params: {
    hostId: string;
    title?: string;
    isPrivate?: boolean;
    maxParticipants?: number;
    movieSlug: string;
    movieImage: string;
    episodeSlug: string;
    settings?: Partial<RoomSettings>;
  }) => {
    const supabase = await createSupabaseServer();

    logger.info("Creating watch party room", {
      hostId: params.hostId,
      movieSlug: params.movieSlug,
      isPrivate: params.isPrivate,
    });

    const defaultSettings: RoomSettings = {
      wait_for_all: false,
      guest_can_chat: true,
      allow_guest_control: false,
      ...params.settings,
    };

    let room = null;
    let retryCount = 0;

    // Retry tạo mã phòng nếu trùng
    while (retryCount < 3) {
      const code = WatchPartyService.generateRoomCode();

      const { data, error } = await supabase
        .from("watch_party_rooms")
        .insert({
          room_code: code,
          host_id: params.hostId,
          current_movie_slug: params.movieSlug,
          current_episode_slug: params.episodeSlug,
          movie_image: params.movieImage,
          title: params.title || `Phòng xem phim`,
          is_private: params.isPrivate || false,
          max_participants: params.maxParticipants || 20,
          settings: defaultSettings,
        })
        .select()
        .single();

      if (!error) {
        room = data;
        break;
      }

      if (error.code === "23505") {
        retryCount++;
        logger.warn("Room code collision, retrying", { attempt: retryCount });
        continue;
      }
      logger.error("Failed to create room", { error: error.message });
      throw error;
    }

    if (!room) {
      logger.error("Failed to create room after 3 retries", {
        hostId: params.hostId,
      });
      throw new BadRequestError(
        "Không thể tạo phòng sau 3 lần thử",
        "ROOM_CREATE_FAILED",
      );
    }

    // Thêm host vào participants
    const { error: participantErr } = await supabase
      .from("watch_party_participants")
      .insert({
        room_id: room.id,
        user_id: params.hostId,
        role: "host",
        status: "approved",
      });

    if (participantErr) {
      logger.error("Failed to add host participant, rolling back", {
        roomId: room.id,
        error: participantErr.message,
      });
      // Rollback: xóa phòng nếu không thêm được host
      await supabase.from("watch_party_rooms").delete().eq("id", room.id);
      throw new BadRequestError(
        "Không thể khởi tạo quyền Host",
        "HOST_INIT_FAILED",
      );
    }

    // Khởi tạo state trên Redis
    if (redis) {
      const initialState: WatchPartyVideoState = {
        status: "pause",
        time: 0,
        episode_slug: params.episodeSlug,
        active_controller_id: params.hostId,
        version: 0,
        updated_at: Date.now(),
      };
      await Promise.all([
        redis.set(`wp:room:${room.id}:state`, initialState, {
          ex: REDIS_STATE_TTL,
        }),
        redis.set(`wp:room:${room.id}:state:version`, 0, {
          ex: REDIS_STATE_TTL,
        }),
      ]);
    }

    logger.info("Room created successfully", {
      roomId: room.id,
      roomCode: room.room_code,
    });

    // Invalidate lobby cache (new room added)
    await WatchPartyConfigService.invalidateLobbyCache();

    return room;
  },

  /**
   * Lấy thông tin phòng (với Redis caching)
   */
  getRoom: async (roomId?: string, roomCode?: string) => {
    if (!roomId && !roomCode) {
      throw new BadRequestError(
        "Missing roomId or roomCode",
        "MISSING_ROOM_IDENTIFIER",
      );
    }

    // Try cache first if roomId is provided
    if (roomId && redis) {
      const cached = await redis.get(`wp:room:${roomId}:info`);
      if (cached) {
        // Get state from Redis
        const state: WatchPartyVideoState | null = await redis.get(
          `wp:room:${roomId}:state`,
        );

        const calculatedAt = Date.now();
        let actualTime = state?.time || 0;
        if (state?.status === "play") {
          actualTime += (calculatedAt - state.updated_at) / 1000;
        }

        return {
          room: cached,
          state: state
            ? { ...state, time: actualTime, calculated_at: calculatedAt }
            : {
                status: "pause" as const,
                time: 0,
                version: 0,
                updated_at: calculatedAt,
                calculated_at: calculatedAt,
              },
        };
      }
    }

    const supabase = await createSupabaseServer();

    let query = supabase
      .from("watch_party_rooms")
      .select(
        `
        *,
        host:profiles!host_id(full_name, avatar_url),
        participants:watch_party_participants(count)
      `,
      )
      .eq("is_active", true);

    if (roomId) query = query.eq("id", roomId);
    else query = query.eq("room_code", roomCode);

    const { data: room, error } = await query.single();

    if (error || !room) {
      throw new RoomNotFoundError();
    }

    // Cache room info for 5 minutes
    if (redis) {
      await redis.set(`wp:room:${room.id}:info`, room, { ex: 300 });
    }

    // Lấy state từ Redis
    let state: WatchPartyVideoState | null = null;
    if (redis) {
      state = await redis.get(`wp:room:${room.id}:state`);
    }

    const calculatedAt = Date.now();
    let actualTime = state?.time || 0;

    // Tính toán time drift nếu đang play
    if (state?.status === "play") {
      actualTime += (calculatedAt - state.updated_at) / 1000;
    }

    return {
      room,
      state: state
        ? { ...state, time: actualTime, calculated_at: calculatedAt }
        : { status: "pause" as const, time: 0, calculated_at: calculatedAt },
    };
  },

  /**
   * Đóng phòng và xóa toàn bộ data liên quan
   */
  closeRoom: async (roomId: string, userId: string) => {
    const supabase = await createSupabaseServer();

    logger.info("Closing watch party room", { roomId, userId });

    // 1. Kiểm tra quyền (chỉ host mới được đóng)
    const { data: participant } = await supabase
      .from("watch_party_participants")
      .select("role")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .single();

    if (!participant || participant.role !== "host") {
      throw new NotHostError("Chỉ chủ phòng mới có quyền đóng phòng");
    }

    // 2. Xóa toàn bộ data liên quan (cascade delete)
    // Thứ tự quan trọng: xóa child tables trước, parent table sau
    const deletePromises = [
      // Xóa participants
      supabase.from("watch_party_participants").delete().eq("room_id", roomId),

      // Xóa messages
      supabase.from("watch_party_messages").delete().eq("room_id", roomId),

      // Xóa playlist
      supabase.from("watch_party_playlist").delete().eq("room_id", roomId),
    ];

    const results = await Promise.allSettled(deletePromises);

    // Log errors nhưng không throw (vì có thể table rỗng)
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        logger.warn("Failed to delete related data", {
          table: ["participants", "messages", "playlist"][index],
          error: result.reason,
        });
      }
    });

    // 3. Xóa room chính
    const { error: roomError } = await supabase
      .from("watch_party_rooms")
      .delete()
      .eq("id", roomId);

    if (roomError) {
      logger.error("Failed to delete room", { roomId, error: roomError });
      throw roomError;
    }

    // 4. Cleanup Redis
    if (redis) {
      await Promise.allSettled([
        redis.del(`wp:room:${roomId}:state`),
        redis.del(`wp:room:${roomId}:info`),
        redis.del(`wp:room:${roomId}:lock`),
      ]);
    }

    // 5. Invalidate lobby cache (room deleted)
    await WatchPartyConfigService.invalidateLobbyCache();

    logger.info("Room closed successfully", { roomId });
    return { success: true };
  },

  /**
   * Generate room code
   */
  generateRoomCode: () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  },

  // ==================== PARTICIPANT MANAGEMENT ====================

  /**
   * Join phòng
   */
  joinRoom: async (roomId: string, userId: string) => {
    const supabase = await createSupabaseServer();

    // Validate input
    const validationResult = joinRoomSchema.safeParse({ roomId });
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      logger.warn("Join room validation failed", {
        roomId,
        userId,
        error: firstError.message,
      });
      throw new BadRequestError(firstError.message, "VALIDATION_ERROR");
    }

    logger.info("User attempting to join room", { roomId, userId });

    // 1. Lấy thông tin phòng
    const { data: room, error: roomErr } = await supabase
      .from("watch_party_rooms")
      .select("is_private, max_participants, is_active")
      .eq("id", roomId)
      .single();

    if (roomErr || !room) {
      logger.warn("Room not found", { roomId, userId });
      throw new RoomNotFoundError();
    }

    if (!room.is_active) {
      logger.warn("Room is inactive", { roomId, userId });
      throw new RoomClosedError();
    }

    // 2. Kiểm tra xem phòng có host không
    const { data: currentHost } = await supabase
      .from("watch_party_participants")
      .select("user_id")
      .eq("room_id", roomId)
      .eq("role", "host")
      .maybeSingle();

    const hasHost = !!currentHost;

    // 3. Kiểm tra user đã từng vào chưa
    const { data: existing } = await supabase
      .from("watch_party_participants")
      .select("status, role")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .single();

    if (existing) {
      if (existing.status === "blocked") {
        logger.warn("Blocked user attempted to join", { roomId, userId });
        throw new ForbiddenError(
          "Bạn đã bị chặn khỏi phòng này",
          "USER_BLOCKED",
        );
      }

      // Nếu phòng không có host và user này chưa phải host → promote
      if (!hasHost && existing.role !== "host") {
        logger.info("No host in room, promoting rejoining user to host", {
          roomId,
          userId,
        });

        const { error: promoteError } = await supabase
          .from("watch_party_participants")
          .update({
            role: "host",
            status: "approved",
            permissions: {
              can_control_media: true,
              can_manage_users: true,
            },
          })
          .eq("room_id", roomId)
          .eq("user_id", userId);

        if (promoteError) {
          logger.error("Failed to promote rejoining user to host", {
            roomId,
            userId,
            error: promoteError.message,
          });
        } else {
          return { success: true, status: "approved", promoted_to_host: true };
        }
      }

      logger.info("User already in room", {
        roomId,
        userId,
        status: existing.status,
      });
      return { success: true, status: existing.status };
    }

    // 3. Kiểm tra số lượng (chỉ tính approved)
    const { count } = await supabase
      .from("watch_party_participants")
      .select("*", { count: "exact", head: true })
      .eq("room_id", roomId)
      .eq("status", "approved");

    if (!room.is_private && count !== null && count >= room.max_participants) {
      logger.warn("Room is full", {
        roomId,
        userId,
        count,
        max: room.max_participants,
      });
      throw new RoomFullError();
    }

    // 4. Insert
    // Nếu phòng không có host → người mới vào sẽ trở thành host
    const status = room.is_private ? "pending" : "approved";
    const role = !hasHost ? "host" : "guest";
    const permissions = !hasHost
      ? { can_control_media: true, can_manage_users: true }
      : undefined;

    const { error } = await supabase
      .from("watch_party_participants")
      .insert({
        room_id: roomId,
        user_id: userId,
        status,
        role,
        permissions,
      });

    if (error) {
      if (error.code === "23505") {
        logger.debug("Duplicate participant insert (race condition)", {
          roomId,
          userId,
        });

        // Re-query actual status
        const { data: existing } = await supabase
          .from("watch_party_participants")
          .select("status, role")
          .eq("room_id", roomId)
          .eq("user_id", userId)
          .single();

        return {
          success: true,
          status: existing?.status || status,
          promoted_to_host: existing?.role === "host",
        };
      }
      logger.error("Failed to insert participant", {
        roomId,
        userId,
        error: error.message,
      });
      throw error;
    }

    // 5. Re-check cho public rooms (fix race condition)
    if (!room.is_private) {
      const { count: finalCount } = await supabase
        .from("watch_party_participants")
        .select("*", { count: "exact", head: true })
        .eq("room_id", roomId)
        .eq("status", "approved");

      if (finalCount !== null && finalCount > room.max_participants) {
        logger.warn("Room exceeded capacity, rolling back", {
          roomId,
          userId,
          finalCount,
          max: room.max_participants,
        });
        // Rollback
        await supabase
          .from("watch_party_participants")
          .delete()
          .eq("room_id", roomId)
          .eq("user_id", userId);

        throw new RoomFullError();
      }
    }

    logger.info("User joined room successfully", {
      roomId,
      userId,
      status,
      role,
      promoted_to_host: role === "host",
    });
    return { success: true, status, promoted_to_host: role === "host" };
  },

  /**
   * Leave phòng
   */
  leaveRoom: async (roomId: string, userId: string) => {
    const supabase = await createSupabaseServer();

    // Validate input
    const validationResult = leaveRoomSchema.safeParse({ roomId });
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      logger.warn("Leave room validation failed", {
        roomId,
        userId,
        error: firstError.message,
      });
      throw new BadRequestError(firstError.message, "VALIDATION_ERROR");
    }

    logger.info("User leaving room", { roomId, userId });

    // 1. Đếm số người còn lại trong phòng (trước khi xóa)
    const { count: remainingCount } = await supabase
      .from("watch_party_participants")
      .select("*", { count: "exact", head: true })
      .eq("room_id", roomId);

    logger.debug("Participants remaining before leave", {
      roomId,
      userId,
      remainingCount,
    });

    // 2. Delete participant (may trigger room deletion via database trigger)
    const { error: deleteError } = await supabase
      .from("watch_party_participants")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", userId);

    // Ignore "not found" errors (user already removed by another process)
    if (deleteError && deleteError.code !== "PGRST116") {
      logger.error("Failed to delete participant", {
        roomId,
        userId,
        error: deleteError.message,
      });
      throw deleteError;
    }

    // 3. Nếu đây là người cuối cùng rời phòng → cleanup ghost hosts
    if (remainingCount === 1) {
      logger.info("Last participant leaving, checking for ghost hosts", {
        roomId,
        userId,
      });

      // Kiểm tra xem còn ai trong phòng không
      const { data: remainingParticipants } = await supabase
        .from("watch_party_participants")
        .select("user_id, role")
        .eq("room_id", roomId);

      // Nếu phòng trống hoặc chỉ còn ghost hosts → xóa hết
      if (!remainingParticipants || remainingParticipants.length === 0) {
        logger.info("Room is empty, no cleanup needed", { roomId });
      } else {
        // Có ghost hosts → xóa chúng
        const ghostHostIds = remainingParticipants
          .filter((p) => p.role === "host")
          .map((p) => p.user_id);

        if (ghostHostIds.length > 0) {
          logger.warn("Found ghost hosts, cleaning up", {
            roomId,
            ghostHostIds,
          });

          const { error: cleanupError } = await supabase
            .from("watch_party_participants")
            .delete()
            .eq("room_id", roomId)
            .in("user_id", ghostHostIds);

          if (cleanupError) {
            logger.error("Failed to cleanup ghost hosts", {
              roomId,
              error: cleanupError.message,
            });
          } else {
            logger.info("Ghost hosts cleaned up successfully", {
              roomId,
              count: ghostHostIds.length,
            });
          }
        }
      }
    }

    // 4. Check if room still exists (non-blocking)
    // Use maybeSingle() to avoid error when room is deleted by trigger
    const { data: room, error: roomError } = await supabase
      .from("watch_party_rooms")
      .select("id")
      .eq("id", roomId)
      .maybeSingle();

    if (roomError) {
      logger.warn("Error checking room existence", {
        roomId,
        error: roomError.message,
      });
    }

    const roomDeleted = !room;

    // 5. Cleanup Redis
    if (redis) {
      if (roomDeleted) {
        // Phòng đã bị xóa → xóa toàn bộ cache
        await Promise.allSettled([
          redis.del(`wp:room:${roomId}:state`),
          redis.del(`wp:room:${roomId}:info`),
          redis.del(`wp:room:${roomId}:lock`),
        ]);
        logger.debug("Redis keys cleaned up (room deleted)", { roomId });
      } else {
        // Phòng vẫn còn → chỉ invalidate room info cache để force refresh
        await redis.del(`wp:room:${roomId}:info`);
        logger.debug("Room info cache invalidated", { roomId, userId });
      }
    }

    // 6. Invalidate lobby cache if room was deleted
    if (roomDeleted) {
      await WatchPartyConfigService.invalidateLobbyCache();
      logger.info("Room deleted, lobby cache invalidated", { roomId });
    }

    logger.info("User left room successfully", { roomId, userId, roomDeleted });
    return { success: true };
  },

  /**
   * Quản lý participant (approve, reject, kick)
   */
  manageParticipant: async (
    roomId: string,
    callerId: string,
    targetUserId: string,
    action: "approve" | "reject" | "kick",
  ) => {
    const supabase = await createSupabaseServer();

    // Validate input
    const validationResult = participantActionSchema.safeParse({
      roomId,
      targetUserId,
      action,
    });

    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      logger.warn("Manage participant validation failed", {
        roomId,
        callerId,
        targetUserId,
        action,
        error: firstError.message,
      });
      throw new BadRequestError(firstError.message, "VALIDATION_ERROR");
    }

    // 1. Kiểm tra quyền của caller
    const { data: caller } = await supabase
      .from("watch_party_participants")
      .select("role, permissions")
      .eq("room_id", roomId)
      .eq("user_id", callerId)
      .single();

    const callerPermissions = caller?.permissions as ParticipantPermissions;
    const canManageUsers =
      caller?.role === "host" || callerPermissions?.can_manage_users;

    if (!canManageUsers) {
      throw new NoPermissionError("Bạn không có quyền quản lý thành viên");
    }

    // 2. Kiểm tra target user
    const { data: targetUser } = await supabase
      .from("watch_party_participants")
      .select("role")
      .eq("room_id", roomId)
      .eq("user_id", targetUserId)
      .single();

    if (!targetUser) {
      throw new NotFoundError("Không tìm thấy người dùng", "USER_NOT_FOUND");
    }

    if (targetUser.role === "host") {
      throw new ForbiddenError(
        "Không thể thao tác lên Chủ phòng",
        "CANNOT_MODIFY_HOST",
      );
    }

    // 3. Thực hiện action
    if (action === "approve") {
      // Kiểm tra capacity trước khi approve
      const { data: room } = await supabase
        .from("watch_party_rooms")
        .select("max_participants")
        .eq("id", roomId)
        .single();

      const { count } = await supabase
        .from("watch_party_participants")
        .select("*", { count: "exact", head: true })
        .eq("room_id", roomId)
        .eq("status", "approved");

      if (room && count !== null && count >= room.max_participants) {
        throw new RoomFullError("Phòng đã đạt giới hạn người tham gia tối đa");
      }

      const { error: approveErr } = await supabase
        .from("watch_party_participants")
        .update({ status: "approved" })
        .eq("room_id", roomId)
        .eq("user_id", targetUserId);

      if (approveErr) {
        logger.error("Failed to approve participant", {
          roomId,
          targetUserId,
          error: approveErr.message,
        });
        throw approveErr;
      }
    } else if (action === "reject") {
      const { error: rejectErr } = await supabase
        .from("watch_party_participants")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", targetUserId)
        .eq("status", "pending");

      if (rejectErr) {
        logger.error("Failed to reject participant", {
          roomId,
          targetUserId,
          error: rejectErr.message,
        });
        throw rejectErr;
      }
    } else if (action === "kick") {
      const { error: kickErr } = await supabase
        .from("watch_party_participants")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", targetUserId);

      if (kickErr) {
        logger.error("Failed to kick participant", {
          roomId,
          targetUserId,
          error: kickErr.message,
        });
        throw kickErr;
      }
    }

    return { success: true };
  },

  // ==================== VIDEO SYNC ====================

  /**
   * Sync video state
   */
  syncVideoState: async (params: {
    roomId: string;
    userId: string;
    status?: "play" | "pause";
    time: number;
    episodeSlug?: string;
  }) => {
    const supabase = await createSupabaseServer();

    logger.debug("Syncing video state", {
      roomId: params.roomId,
      userId: params.userId,
      status: params.status,
      time: params.time,
    });

    // 1. Kiểm tra quyền
    const { data: participant, error: pErr } = await supabase
      .from("watch_party_participants")
      .select(
        `
        role,
        permissions,
        profiles:user_id(full_name),
        room:watch_party_rooms!inner(settings)
      `,
      )
      .eq("room_id", params.roomId)
      .eq("user_id", params.userId)
      .eq("status", "approved")
      .single();

    if (pErr || !participant) {
      throw new NoPermissionError("Bạn không có quyền truy cập phòng này");
    }

    const role = participant.role;
    const permissions = participant.permissions as ParticipantPermissions;

    type RoomJoinData = { settings: RoomSettings };
    const roomData = participant.room as unknown as
      | RoomJoinData
      | RoomJoinData[];

    const roomSettings = (
      Array.isArray(roomData) ? roomData[0]?.settings : roomData?.settings
    ) as RoomSettings;

    const isHost = role === "host";
    const canControlVideo =
      permissions?.can_control_media === true ||
      roomSettings?.allow_guest_control === true;
    const canChangeMovie = permissions?.can_control_media === true;

    if (!isHost && !canControlVideo) {
      throw new NoPermissionError("Bạn không có quyền điều khiển video");
    }

    if (params.episodeSlug && !isHost && !canChangeMovie) {
      throw new NoPermissionError("Bạn không có quyền đổi phim/tập");
    }

    // 2. Validate episode slug nếu có
    if (params.episodeSlug) {
      const isValidFormat = /^[a-zA-Z0-9-]+$/.test(params.episodeSlug);
      if (!isValidFormat) {
        throw new BadRequestError(
          "Tập phim không hợp lệ",
          "INVALID_EPISODE_SLUG",
        );
      }
    }

    // 3. Lấy state cũ và merge
    let currentState: WatchPartyVideoState | null = null;
    if (redis) {
      currentState = await redis.get(`wp:room:${params.roomId}:state`);
    }

    const now = Date.now();
    let nextVersion = (currentState?.version ?? 0) + 1;
    if (redis) {
      nextVersion = await redis.incr(`wp:room:${params.roomId}:state:version`);
      if (currentState?.version && nextVersion <= currentState.version) {
        nextVersion = currentState.version + 1;
        await redis.set(`wp:room:${params.roomId}:state:version`, nextVersion, {
          ex: REDIS_STATE_TTL,
        });
      }
    }
    const profileData = participant.profiles as
      | { full_name?: string | null }
      | { full_name?: string | null }[]
      | null
      | undefined;
    const profile = Array.isArray(profileData) ? profileData[0] : profileData;

    const newState: WatchPartyVideoState = {
      status: params.status || currentState?.status || "pause",
      time: params.time ?? currentState?.time ?? 0,
      episode_slug: params.episodeSlug || currentState?.episode_slug,
      active_controller_id: params.userId,
      active_controller_name: profile?.full_name ?? undefined,
      version: nextVersion,
      updated_at: now,
    };

    // 4. Lưu vào Redis
    if (redis) {
      await redis.set(`wp:room:${params.roomId}:state`, newState, {
        ex: REDIS_STATE_TTL,
      });
    }

    // 5. Update database nếu đổi episode
    if (
      params.episodeSlug &&
      params.episodeSlug !== currentState?.episode_slug
    ) {
      const { error: updateErr } = await supabase
        .from("watch_party_rooms")
        .update({ current_episode_slug: params.episodeSlug })
        .eq("id", params.roomId);

      if (updateErr) {
        logger.error("Failed to update episode slug", {
          roomId: params.roomId,
          episodeSlug: params.episodeSlug,
          error: updateErr.message,
        });
        // Rollback Redis state to maintain consistency
        if (redis) {
          if (currentState) {
            await redis.set(`wp:room:${params.roomId}:state`, currentState, {
              ex: REDIS_STATE_TTL,
            });
          } else {
            // No previous state - remove the newly written state
            await redis.del(`wp:room:${params.roomId}:state`);
          }
        }
        throw updateErr;
      }
    }

    return { success: true, state: newState };
  },
};
