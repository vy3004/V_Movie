import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { HistoryService } from "@/services/history.service";

export const runtime = "edge";

export async function POST(req: Request) {
  try {
    const { localHistory } = await req.json();
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !localHistory)
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });

    await HistoryService.bulkSyncToDB(user.id, localHistory);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
