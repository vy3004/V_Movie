import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/services/admin-movie-indexer/admin.service";
import { mergeAdminMovies } from "@/services/admin-movies/admin.service";

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || "Unknown admin movie merge error");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function POST(req: NextRequest) {
  await requireAdminUser();

  try {
    const body = await req.json();
    if (!isObject(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const movie = await mergeAdminMovies({
      canonicalMovieId: String(body.canonicalMovieId || ""),
      duplicateMovieIds: Array.isArray(body.duplicateMovieIds)
        ? body.duplicateMovieIds.map(String)
        : [],
      fieldValues: isObject(body.fieldValues) ? body.fieldValues : {},
    });
    return NextResponse.json({ movie });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
