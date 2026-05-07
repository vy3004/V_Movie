import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { messageSchema } from "@/lib/validations/message.validation";
import { sanitizeHtml } from "@/lib/utils";
import { WatchPartyContentService } from "@/services/watch-party-content.service";
import { rateLimit } from "@/lib/rate-limit";

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

    // Rate limiting: 5 messages per 10 seconds per user
    const rateLimitResult = await rateLimit(`chat:${user.id}`, 5, 10);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Bạn đang gửi tin nhắn quá nhanh, vui lòng chờ một chút" },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "5",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": rateLimitResult.reset.toString(),
          },
        },
      );
    }

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

    // System messages: broadcast only, don't save to DB
    if (type === "system") {
      const supabase = await createSupabaseServer();

      // Broadcast system message via realtime channel
      await supabase.channel(`wp_data_${roomId}`).send({
        type: "broadcast",
        event: "system_message",
        payload: {
          id,
          room_id: roomId,
          user_id: user.id,
          user_name: cleanUserName,
          avatar_url: cleanAvatarUrl,
          text,
          type: "system",
          created_at: new Date().toISOString(),
          metadata,
        },
      });

      return NextResponse.json({ success: true });
    }

    // Chat messages: save to DB (postgres_changes will broadcast)
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
