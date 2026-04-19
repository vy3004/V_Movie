import { NextResponse } from "next/server";
import { HistoryService } from "@/services/history.service";

export const runtime = "edge";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const deviceId = searchParams.get("deviceId");

  if (!userId && !deviceId) {
    return NextResponse.json({ error: "Missing identity" }, { status: 400 });
  }

  const data = await HistoryService.getList(
    userId || undefined,
    deviceId || undefined,
  );
  return NextResponse.json(data);
}
