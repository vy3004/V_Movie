import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
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

    const { roomId, targetUserId, action } = await request.json();

    // Validate Input
    if (
      !roomId ||
      !targetUserId ||
      !["approve", "reject", "kick"].includes(action)
    ) {
      return NextResponse.json(
        { error: "Dữ liệu đầu vào không hợp lệ" },
        { status: 400 },
      );
    }

    const result = await WatchPartyService.manageParticipant(
      roomId,
      user.id,
      targetUserId,
      action as "approve" | "reject" | "kick",
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("[PARTICIPANT_ACTION_ERROR]:", error);
    const message =
      error instanceof Error ? error.message : "Internal Server Error";

    const statusCode =
      error instanceof Error && "statusCode" in error
        ? Number(error.statusCode)
        : undefined;

    let status = Number.isInteger(statusCode) ? statusCode : 500;
    if (message.includes("không có quyền")) status = 403;
    else if (message.includes("không tìm thấy")) status = 404;
    else if (message.includes("giới hạn")) status = 403;

    return NextResponse.json({ error: message }, { status });
  }
}
