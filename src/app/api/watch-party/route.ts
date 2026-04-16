import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { redis } from "@/lib/redis";

export const runtime = "edge";

const generateRoomCode = () =>
  Math.random().toString(36).substring(2, 8).toUpperCase();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");
    const roomCode = searchParams.get("roomCode");

    if (!roomId && !roomCode)
      return NextResponse.json(
        { error: "Missing ID or Code" },
        { status: 400 },
      );

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
    if (error || !room)
      return NextResponse.json(
        { error: "Phòng không tồn tại" },
        { status: 404 },
      );

    // Lấy trạng thái từ Redis
    const state: any = redis
      ? await redis.get(`wp:room:${room.id}:state`)
      : null;
    let actualTime = state?.time || 0;
    if (state?.status === "playing") {
      actualTime += (Date.now() - state.updated_at) / 1000;
    }

    return NextResponse.json({
      room,
      state: state ? { ...state, actualTime } : { status: "paused", time: 0 },
    });
  } catch (error) {
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

    const {
      title,
      isPrivate,
      maxParticipants,
      movieSlug,
      movieImage,
      episodeSlug,
      settings,
    } = await request.json();

    if (!movieSlug || !movieImage || !episodeSlug)
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );

    let room = null;
    let retryCount = 0;

    // Retry tạo mã phòng không trùng lặp
    while (retryCount < 3) {
      const code = generateRoomCode();

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
            `Phòng xem chung của ${user.user_metadata?.full_name || "User"}`,
          is_private: isPrivate || false,
          max_participants: maxParticipants || 20,
          settings: settings || {
            wait_for_all: false,
            guest_can_chat: true,
            allow_guest_control: false,
          },
        })
        .select()
        .single();

      if (!error) {
        room = data;
        break;
      }

      if (error.code === "23505") {
        // Lỗi trùng unique room_code
        retryCount++;
        continue;
      }
      throw error;
    }

    if (!room) {
      return NextResponse.json(
        { error: "Không thể tạo phòng lúc này" },
        { status: 500 },
      );
    }

    // Thêm Host vào bảng participants với role='host', status='approved'
    await supabase.from("watch_party_participants").insert({
      room_id: room.id,
      user_id: user.id,
      role: "host",
      status: "approved",
    });

    // Khởi tạo State trên Redis (Paused ở giây số 0)
    if (redis) {
      await redis.set(
        `wp:room:${room.id}:state`,
        {
          status: "paused",
          time: 0,
          episode_slug: episodeSlug,
          updated_at: Date.now(),
        },
        { ex: 86400 }, // Tồn tại 24h
      );
    }

    return NextResponse.json({ room });
  } catch (error: any) {
    console.error("[WP_CREATE_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
