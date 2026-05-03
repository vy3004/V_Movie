import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { messageSchema } from "@/lib/validations/message.validation";
import { sanitizeHtml } from "@/lib/utils";
import { WatchPartyContentService } from "@/services/watch-party-content.service";

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

    const messages = await WatchPartyContentService.getMessages(
      roomId,
      user.id,
    );

    return NextResponse.json(messages);
  } catch (error) {
    console.error("[CHAT_GET_ERROR]:", error);
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    const status = message.includes("không phải thành viên") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
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

    const cleanText = sanitizeHtml(body.text || "");

    const result = messageSchema.safeParse({
      ...body,
      text: cleanText,
    });

    if (!result.success) {
      const isActuallyEmpty = (body.text || "").trim().length === 0;
      let errorMessage = result.error.issues[0].message;

      // Thông báo lỗi nếu hacker chèn mã độc
      if (!isActuallyEmpty && errorMessage === "Tin nhắn không được để trống") {
        errorMessage = "Nội dung tin nhắn không hợp lệ";
      }

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const { id, roomId, text, type, metadata } = result.data;

    // Sanitize user metadata để tránh XSS
    const cleanUserName = sanitizeHtml(
      user.user_metadata?.full_name || "Guest",
    );
    const rawAvatarUrl = user.user_metadata?.avatar_url || "";
    let cleanAvatarUrl = "";
    if (rawAvatarUrl) {
      try {
        const url = new URL(rawAvatarUrl);
        if (url.protocol === "https:" || url.protocol === "http:") {
          cleanAvatarUrl = url.href;
        }
      } catch {
        // Invalid URL, keep empty
      }
    }

    const message = await WatchPartyContentService.sendMessage({
      id,
      roomId,
      userId: user.id,
      userName: cleanUserName,
      avatarUrl: cleanAvatarUrl,
      text,
      type: type as "chat" | "system",
      metadata,
    });

    return NextResponse.json(message);
  } catch (error) {
    console.error("[CHAT_POST_ERROR]:", error);
    const message =
      error instanceof Error ? error.message : "Internal Server Error";

    let status = 500;
    if (message.includes("Chưa tham gia")) status = 403;
    else if (message.includes("không tồn tại")) status = 404;
    else if (
      message.includes("bị cấm") ||
      message.includes("đã tắt") ||
      message.includes("không có quyền")
    )
      status = 403;

    return NextResponse.json({ error: message }, { status });
  }
}
