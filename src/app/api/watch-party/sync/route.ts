import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { redis } from "@/lib/redis";
import {
  ParticipantPermissions,
  RoomSettings,
  WatchPartyVideoState,
} from "@/types/watch-party";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { roomId, status, time, episodeSlug } = await request.json();
    if (!roomId)
      return NextResponse.json({ error: "Missing roomId" }, { status: 400 });

    // 1. Lấy thông tin & Quyền hạn của user
    const { data: participant, error: pErr } = await supabase
      .from("watch_party_participants")
      .select(
        `
        role, 
        permissions,
        room:watch_party_rooms!inner(settings)
      `,
      )
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .eq("status", "approved")
      .single();

    if (pErr || !participant) {
      return NextResponse.json(
        { error: "Bạn không có quyền truy cập phòng này" },
        { status: 403 },
      );
    }

    // 2. Ép kiểu an toàn
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

    // 3. Phân quyền chặt chẽ (Tách biệt quyền Control và quyền Đổi phim)
    if (!isHost && !canControlVideo) {
      return NextResponse.json(
        { error: "Bạn không có quyền điều khiển video" },
        { status: 403 },
      );
    }

    if (episodeSlug && !isHost && !canChangeMovie) {
      return NextResponse.json(
        { error: "Bạn không có quyền đổi phim/tập" },
        { status: 403 },
      );
    }

    // 4. Lấy State cũ từ Redis để Merge (Fix lỗi mất trạng thái)
    let currentState: WatchPartyVideoState | null = null;
    if (redis) {
      currentState = await redis.get(`wp:room:${roomId}:state`);
    }

    // Gộp state: Ưu tiên dữ liệu mới gửi lên, nếu không có thì giữ nguyên dữ liệu cũ
    const newState: WatchPartyVideoState = {
      status: status || currentState?.status || "pause",
      time: time ?? currentState?.time ?? 0,
      episode_slug: episodeSlug || currentState?.episode_slug,
      updated_at: Date.now(),
    };

    // 5. Lưu lại vào Redis
    if (redis) {
      await redis.set(`wp:room:${roomId}:state`, newState, { ex: 86400 });
    }

    // 6. FIX LỖI EDGE RUNTIME: Cần dùng `await` để đảm bảo lệnh DB chạy xong trước khi trả response
    if (episodeSlug && episodeSlug !== currentState?.episode_slug) {
      const { error: dbError } = await supabase
        .from("watch_party_rooms")
        .update({ current_episode_slug: episodeSlug })
        .eq("id", roomId);

      if (dbError) console.error("[WP_SYNC_DB_UPDATE_ERROR]:", dbError);
    }

    return NextResponse.json({ success: true, state: newState });
  } catch (error) {
    console.error("[WP_SYNC_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
