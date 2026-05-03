import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { WatchPartyConfigService } from "@/services/watch-party-config.service";

export const runtime = "edge";

export async function PATCH(request: Request) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { roomId, title, is_private, max_participants, is_active, settings } =
      body;

    if (!roomId)
      return NextResponse.json({ error: "Missing roomId" }, { status: 400 });

    const result = await WatchPartyConfigService.updateSettings({
      roomId,
      userId: user.id,
      title,
      isPrivate: is_private,
      maxParticipants: max_participants,
      isActive: is_active,
      settings,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[WP_SETTINGS_UPDATE_ERROR]:", error);
    const message =
      error instanceof Error ? error.message : "Internal Server Error";

    let status = 500;
    if (message.includes("không tồn tại")) status = 404;
    else if (
      message.includes("không có quyền") ||
      message.includes("Chỉ Chủ phòng")
    )
      status = 403;

    return NextResponse.json({ error: message }, { status });
  }
}
