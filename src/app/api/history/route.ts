import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { HistoryService } from "@/services/history.service";

export const runtime = "edge";

// SYNC (LƯU) PHIM VÀO DB
export async function POST(req: Request) {
  try {
    const historyItem = await req.json();
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await HistoryService.syncItemToDB(user.id, historyItem);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API_HISTORY_POST]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

// XÓA PHIM (1 PHIM HOẶC TẤT CẢ)
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const movieSlug = searchParams.get("movieSlug");

    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (movieSlug) {
      // Nếu có movieSlug -> Xóa 1 phim
      await HistoryService.deleteItem(user.id, movieSlug);
    } else {
      // Nếu không có movieSlug -> Xóa tất cả
      await HistoryService.clearAll(user.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API_HISTORY_DELETE]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
