import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { redis } from "@/lib/redis";
import { WatchPartyVideoState, RoomSettings } from "@/types/watch-party"; // Import interface của bạn

export const runtime = "edge";

const generateRoomCode = () =>
  Math.random().toString(36).substring(2, 8).toUpperCase();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");
    const roomCode = searchParams.get("roomCode");

    if (!roomId && !roomCode) {
      return NextResponse.json(
        { error: "Missing ID or Code" },
        { status: 400 },
      );
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
      return NextResponse.json(
        { error: "Phòng không tồn tại hoặc đã đóng" },
        { status: 404 },
      );
    }

    // XỬ LÝ REDIS VỚI TYPE CHUẨN (Không dùng any)
    let state: WatchPartyVideoState | null = null;
    if (redis) {
      state = await redis.get(`wp:room:${room.id}:state`);
    }

    let actualTime = state?.time || 0;

    // TÍNH TOÁN BÙ TRỪ ĐỘ TRỄ (Chỉ cộng thêm nếu video đang play)
    if (state?.status === "play") {
      // Sửa lại thành "play" cho chuẩn với logic Client
      actualTime += (Date.now() - state.updated_at) / 1000;
    }

    return NextResponse.json({
      room,
      state: state
        ? { ...state, time: actualTime }
        : { status: "pause", time: 0 },
    });
  } catch (error) {
    console.error("[WP_GET_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const {
      title,
      isPrivate,
      maxParticipants,
      movieSlug,
      movieImage,
      episodeSlug,
      settings,
    } = body;

    if (!movieSlug || !movieImage || !episodeSlug) {
      return NextResponse.json(
        { error: "Thiếu dữ liệu bắt buộc" },
        { status: 400 },
      );
    }

    let room = null;
    let retryCount = 0;

    // Retry tạo mã phòng
    while (retryCount < 3) {
      const code = generateRoomCode();
      const defaultSettings: RoomSettings = settings || {
        wait_for_all: false,
        guest_can_chat: true,
        allow_guest_control: false,
      };

      const { data, error } = await supabase
        .from("watch_party_rooms")
        .insert({
          room_code: code,
          host_id: user.id,
          current_movie_slug: movieSlug,
          current_episode_slug: episodeSlug,
          movie_image: movieImage,
          title:
            title ||
            `Cùng xem phim với ${user.user_metadata?.full_name || "User"}`,
          is_private: isPrivate || false,
          max_participants: maxParticipants || 20,
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
        continue;
      }
      throw error;
    }

    if (!room) {
      return NextResponse.json(
        { error: "Hệ thống quá tải, không thể tạo phòng" },
        { status: 500 },
      );
    }

    const { error: participantErr } = await supabase
      .from("watch_party_participants")
      .insert({
        room_id: room.id,
        user_id: user.id,
        role: "host",
        status: "approved",
      });

    if (participantErr) {
      // Nếu thêm Host thất bại, xóa luôn phòng vừa tạo để tránh rác DB
      await supabase.from("watch_party_rooms").delete().eq("id", room.id);
      console.error("[WP_HOST_INSERT_ERROR]:", participantErr);
      return NextResponse.json(
        { error: "Không thể khởi tạo quyền Host" },
        { status: 500 },
      );
    }

    // Khởi tạo State trên Redis (Type Safe)
    if (redis) {
      const initialState: WatchPartyVideoState = {
        status: "pause",
        time: 0,
        episode_slug: episodeSlug,
        updated_at: Date.now(),
      };

      await redis.set(`wp:room:${room.id}:state`, initialState, { ex: 86400 }); // 24h
    }

    return NextResponse.json({ room });
  } catch (error) {
    console.error("[WP_CREATE_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
