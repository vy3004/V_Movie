import { AccessToken } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServer();

    // 1. LẤY THÔNG TIN USER TỪ SESSION (BẢO MẬT)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized - Vui lòng đăng nhập" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { roomCode } = body; // Chỉ lấy mã phòng từ body

    if (!roomCode) {
      return NextResponse.json(
        { error: "Thiếu thông tin mã phòng (roomCode)" },
        { status: 400 },
      );
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "Server chưa cấu hình LiveKit credentials" },
        { status: 500 },
      );
    }

    // 2. TÌM PHÒNG (Dùng maybeSingle() để tránh sập luồng)
    const { data: roomData, error: roomError } = await supabase
      .from("watch_party_rooms")
      .select("id")
      .eq("room_code", roomCode)
      .maybeSingle();

    if (roomError || !roomData) {
      return NextResponse.json(
        { error: "Phòng xem chung không tồn tại hoặc đã đóng" },
        { status: 404 },
      );
    }

    // 3. LẤY TRẠNG THÁI "CẤM MIC" VÀ TÊN USER (Dùng maybeSingle())
    // participantId lúc này chính là user.id lấy từ hệ thống
    const { data: participantData, error: participantError } = await supabase
      .from("watch_party_participants")
      .select("is_voice_muted, profiles(full_name)")
      .eq("room_id", roomData.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (participantError) {
      console.error("Lỗi khi truy vấn participant:", participantError);
      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500 },
      );
    }

    // Mặc định là false nếu không tìm thấy participant (chưa join phòng)
    const isVoiceMuted = participantData?.is_voice_muted ?? false;
    // Lấy tên từ Supabase, nếu lỗi hoặc không có thì để mặc định
    const username = participantData?.profiles?.[0]?.full_name || "Thành viên";

    // -------------------------------------------------------------

    // 4. Khởi tạo một cái "Vé" (AccessToken)
    const at = new AccessToken(apiKey, apiSecret, {
      identity: user.id, // Sử dụng ID bảo mật từ server
      name: username,
    });

    // 5. Gắn quyền hạn (Permissions) vào cái vé này
    at.addGrant({
      roomJoin: true,
      room: roomCode,
      // NẾU BỊ CẤM MIC TỪ DB -> TƯỚC QUYỀN PHÁT ÂM THANH LÊN SERVER LUN!
      canPublish: !isVoiceMuted,
      canPublishData: false,
      canSubscribe: true, // Vẫn cho họ quyền nghe người khác nói
    });

    // 6. Ký cái vé thành chuỗi mã hóa JWT và trả về cho Frontend
    const token = await at.toJwt();

    return NextResponse.json({ token });
  } catch (error) {
    console.error("Lỗi khi tạo Voice Token:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
