import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/services/admin-movie-indexer/admin.service";
import { listAdminMovies } from "@/services/admin-movies/admin.service";

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || "Unknown admin movie error");
}

export async function GET(req: NextRequest) {
  await requireAdminUser();

  try {
    const rawParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const result = await listAdminMovies(rawParams);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
