import { createSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { WatchPartyService } from "@/services/watch-party.service";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { roomId, newHostUserId } = await request.json();

    if (!roomId)
      return NextResponse.json({ error: "Missing Room ID" }, { status: 400 });

    // Kiểm tra xem user có phải host không
    const { data: participant } = await supabase
      .from("watch_party_participants")
      .select("role")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .single();

    if (!participant) {
      return NextResponse.json({ error: "Not in room" }, { status: 404 });
    }

    // Nếu là host → chuyển giao quyền nếu có newHostUserId
    if (participant.role === "host") {
      // Nếu có chỉ định host mới → promote họ trước khi rời
      if (newHostUserId) {
        // Validate new host exists in room
        const { data: newHost, error: fetchError } = await supabase
          .from("watch_party_participants")
          .select("user_id")
          .eq("room_id", roomId)
          .eq("user_id", newHostUserId)
          .eq("status", "approved")
          .single();

        if (fetchError || !newHost) {
          return NextResponse.json(
            { error: "New host not found in room" },
            { status: 400 },
          );
        }

        // Update new host
        const { error: updateError } = await supabase
          .from("watch_party_participants")
          .update({
            role: "host",
            permissions: {
              can_control_media: true,
              can_manage_users: true,
            },
          })
          .eq("room_id", roomId)
          .eq("user_id", newHostUserId);

        if (updateError) {
          return NextResponse.json(
            { error: "Failed to promote new host" },
            { status: 500 },
          );
        }
      }

      // Sau đó rời phòng
      await WatchPartyService.leaveRoom(roomId, user.id);
      return NextResponse.json({ success: true });
    }

    // Nếu là guest → gửi broadcast request cho host xóa
    // Broadcast qua Supabase Realtime channel
    const channel = supabase.channel(`wp_ui_${roomId}`);

    // Subscribe channel trước khi send với timeout
    await Promise.race([
      new Promise<void>((resolve, reject) => {
        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") resolve();
          else if (status === "CHANNEL_ERROR") reject(new Error("Channel error"));
        });
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Channel subscription timeout")), 5000)
      ),
    ]);

    await channel.send({
      type: "broadcast",
      event: "request_leave",
      payload: {
        userId: user.id,
        timestamp: Date.now(),
      },
    });

    // Đợi 1 giây để host nhận được request
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Cleanup channel
    await supabase.removeChannel(channel);

    return NextResponse.json({ success: true, pending: true });
  } catch (error) {
    console.error("[LEAVE_ROOM_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
