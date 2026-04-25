import { NextResponse } from "next/server";
import { HistoryService } from "@/services/history.service";

export const runtime = "edge";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const deviceId = searchParams.get("deviceId");

  // Các tham số cho Infinite Scroll & Search
  const MAX_LIMIT = 100;
  const parsedPage = parseInt(searchParams.get("page") || "1", 10);
  const parsedLimit = parseInt(searchParams.get("limit") || "12", 10);

  const page = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
  const limit =
    Number.isNaN(parsedLimit) || parsedLimit < 1
      ? 12
      : Math.min(parsedLimit, MAX_LIMIT);
  const keyword = searchParams.get("keyword") || "";
  const filter = searchParams.get("filter") || "all";
  if (!userId && !deviceId) {
    return NextResponse.json({ error: "Missing identity" }, { status: 400 });
  }

  // Gọi Service lấy dữ liệu
  const result = await HistoryService.getListPaginated({
    userId: userId || undefined,
    deviceId: deviceId || undefined,
    page,
    limit,
    keyword,
    filter,
  });

  // Trả về toàn bộ result (bao gồm data, nextCursor, total)
  return NextResponse.json(result);
}
