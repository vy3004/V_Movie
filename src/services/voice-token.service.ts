import "server-only";

import { createSupabaseServer } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { AccessToken } from "livekit-server-sdk";

/**
 * Voice Token Service (Node.js only)
 * Handles LiveKit voice token generation
 */
export const VoiceTokenService = {
  /**
   * Generate LiveKit voice token
   */
  generateToken: async (params: { roomCode: string; userId: string }) => {
    const supabase = await createSupabaseServer();

    logger.info("Generating voice token", {
      roomCode: params.roomCode,
      userId: params.userId,
    });

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      logger.error("LiveKit credentials not configured");
      throw new Error("Server chưa cấu hình LiveKit credentials");
    }

    // 1. Tìm phòng
    const { data: roomData, error: roomError } = await supabase
      .from("watch_party_rooms")
      .select("id")
      .eq("room_code", params.roomCode)
      .maybeSingle();

    if (roomError || !roomData) {
      logger.warn("Room not found for voice token", {
        roomCode: params.roomCode,
      });
      throw new Error("Phòng xem chung không tồn tại hoặc đã đóng");
    }

    // 2. Lấy trạng thái voice muted và tên user
    const { data: participantData, error: participantError } = await supabase
      .from("watch_party_participants")
      .select("is_voice_muted, profiles(full_name)")
      .eq("room_id", roomData.id)
      .eq("user_id", params.userId)
      .maybeSingle();

    if (participantError) {
      logger.error("Failed to fetch participant for voice token", {
        roomId: roomData.id,
        userId: params.userId,
        error: participantError.message,
      });
      throw participantError;
    }

    if (!participantData) {
      logger.warn("User is not a participant of the room", {
        roomId: roomData.id,
        userId: params.userId,
      });
      throw new Error("Bạn không phải là thành viên của phòng này");
    }

    const isVoiceMuted = participantData.is_voice_muted ?? false;
    const username =
      (participantData.profiles as unknown as { full_name: string })
        ?.full_name || "Thành viên";

    // 3. Tạo access token
    const at = new AccessToken(apiKey, apiSecret, {
      identity: params.userId,
      name: username,
    });

    at.addGrant({
      roomJoin: true,
      room: params.roomCode,
      canPublish: !isVoiceMuted,
      canPublishData: false,
      canSubscribe: true,
    });

    const token = await at.toJwt();

    logger.info("Voice token generated", {
      roomCode: params.roomCode,
      userId: params.userId,
      isVoiceMuted,
    });

    return { token };
  },
};
