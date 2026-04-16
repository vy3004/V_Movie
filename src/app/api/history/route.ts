import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { HistoryService } from "@/services/history.service";

export const runtime = "edge";

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
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
