import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { VoiceTokenService } from "@/services/voice-token.service";

// Voice token requires Node.js runtime for livekit-server-sdk
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServer();

    // 1. Lấy thông tin user từ session
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

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { roomCode } = body;

    if (!roomCode) {
      return NextResponse.json(
        { error: "Thiếu thông tin mã phòng (roomCode)" },
        { status: 400 },
      );
    }

    const result = await VoiceTokenService.generateToken({
      roomCode,
      userId: user.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Lỗi khi tạo Voice Token:", error);
    const message =
      error instanceof Error ? error.message : "Internal Server Error";

    let status = 500;
    if (message.includes("không tồn tại") || message.includes("đã đóng"))
      status = 404;
    else if (message.includes("chưa cấu hình")) status = 500;

    return NextResponse.json({ error: message }, { status });
  }
}
