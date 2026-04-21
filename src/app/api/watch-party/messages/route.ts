import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { messageSchema } from "@/lib/validations/message.validation";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");

    if (!roomId) {
      return NextResponse.json({ error: "Missing Room ID" }, { status: 400 });
    }

    // Kiểm tra user có phải là thành viên phòng không
    const { data: participant } = await supabase
      .from("watch_party_participants")
      .select("id")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .single();

    if (!participant) {
      return NextResponse.json({ error: "Not a participant" }, { status: 403 });
    }

    // Lấy 50 tin nhắn gần nhất
    const { data: messages, error } = await supabase
      .from("watch_party_messages")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json(messages?.reverse() ?? []);
  } catch (error) {
    console.error("[CHAT_GET_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

// --- 2. HÀM GỬI TIN NHẮN (BẢN BẢO MẬT TỐI ĐA) ---
export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsedData = messageSchema.safeParse(body);

    if (!parsedData.success) {
      return NextResponse.json(
        { error: parsedData.error.issues[0].message },
        { status: 400 },
      );
    }

    const { id, roomId, text, type, metadata } = parsedData.data;

    // Lấy quyền của User và Setting của phòng
    const [{ data: participant }, { data: roomInfo }] = await Promise.all([
      supabase
        .from("watch_party_participants")
        .select("role, is_muted, permissions")
        .eq("room_id", roomId)
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("watch_party_rooms")
        .select("settings")
        .eq("id", roomId)
        .single(),
    ]);

    if (!participant) {
      return NextResponse.json(
        { error: "Chưa tham gia phòng" },
        { status: 403 },
      );
    }

    if (!roomInfo) {
      return NextResponse.json(
        { error: "Phòng không tồn tại" },
        { status: 404 },
      );
    }

    const isHost = participant.role === "host";
    const isMod = !!participant.permissions?.can_manage_users;

    // Chặn theo loại tin nhắn
    if (type === "chat") {
      if (participant.is_muted) {
        return NextResponse.json({ error: "Bạn bị cấm chat" }, { status: 403 });
      }
      const guestCanChat = roomInfo?.settings?.guest_can_chat ?? true;
      if (!isHost && !isMod && !guestCanChat) {
        return NextResponse.json(
          { error: "Phòng đã tắt chat" },
          { status: 403 },
        );
      }
    } else if (type === "system" && !isHost && !isMod) {
      return NextResponse.json(
        { error: "Không có quyền gửi tin hệ thống" },
        { status: 403 },
      );
    }

    // Insert tin nhắn
    const { data: message, error: mErr } = await supabase
      .from("watch_party_messages")
      .insert({
        id,
        room_id: roomId,
        user_id: user.id,
        user_name: user.user_metadata?.full_name || "Guest",
        avatar_url: user.user_metadata?.avatar_url || "",
        text,
        type,
        metadata,
      })
      .select()
      .single();

    if (mErr) throw mErr;

    return NextResponse.json(message);
  } catch (error) {
    console.error("[CHAT_POST_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
