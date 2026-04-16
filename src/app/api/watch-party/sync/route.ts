import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { redis } from "@/lib/redis";

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

    let role = null;

    // 1. Check quyền từ Redis trước (Tránh Spam DB)
    if (redis) {
      const cachedRole = await redis.get(`wp:room:${roomId}:role:${user.id}`);
      if (cachedRole) role = cachedRole;
    }

    // 2. Nếu Redis không có, mới gọi DB và set lại Redis Cache
    if (!role) {
      const { data: participant } = await supabase
        .from("watch_party_participants")
        .select("role, status")
        .eq("room_id", roomId)
        .eq("user_id", user.id)
        .eq("status", "approved") // Chỉ lấy user đã được duyệt
        .single();

      if (!participant) {
        return NextResponse.json(
          { error: "Bạn không có quyền" },
          { status: 403 },
        );
      }

      role = participant.role;
      if (redis) {
        // Cache quyền trong 4 tiếng
        await redis.set(`wp:room:${roomId}:role:${user.id}`, role, {
          ex: 14400,
        });
      }
    }

    // 3. Chặn nếu không phải Host hoặc Moderator
    if (role !== "host" && role !== "moderator") {
      return NextResponse.json(
        { error: "Chỉ Host/Mod mới được điều khiển" },
        { status: 403 },
      );
    }

    // 4. Update Trạng thái Video lên Redis
    const newState = {
      status, // "playing" | "paused" | undefined
      time,
      episode_slug: episodeSlug,
      updated_at: Date.now(),
    };

    if (redis)
      await redis.set(`wp:room:${roomId}:state`, newState, { ex: 86400 });

    // 5. Nếu có đổi tập, lưu DB (Chạy ngầm không cần await để API phản hồi nhanh)
    if (episodeSlug) {
      supabase
        .from("watch_party_rooms")
        .update({ current_episode_slug: episodeSlug })
        .eq("id", roomId)
        .then(); // Fire and forget
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[WP_SYNC_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
