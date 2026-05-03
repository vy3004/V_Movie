import { NextResponse } from "next/server";
import { WatchPartyConfigService } from "@/services/watch-party-config.service";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const page = Math.max(
      0,
      parseInt(searchParams.get("page") || "0", 10) || 0,
    );
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "12", 10) || 12),
    );

    const result = await WatchPartyConfigService.getLobby({
      search,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[WP_LIST_ERROR]:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
