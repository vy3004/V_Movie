import { NextResponse } from "next/server";
import { HistoryService } from "@/services/history.service";

export const runtime = "edge";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "Missing identity" }, { status: 400 });
  }

  try {
    const stats = await HistoryService.getStats(userId);
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Failed to fetch history stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 },
    );
  }
}
