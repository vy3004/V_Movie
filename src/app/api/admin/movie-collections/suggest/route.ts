import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/services/admin-movie-indexer/admin.service";
import { suggestMovieCollections } from "@/services/admin-movies/collection-suggestions";

const MAX_MOVIE_IDS = 50;

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || "Unknown movie collection suggestion error");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function POST(req: NextRequest) {
  await requireAdminUser();

  try {
    const body = await req.json().catch(() => ({}));
    if (!isObject(body) || !Array.isArray(body.movieIds)) {
      return NextResponse.json(
        { error: 'Request body must include "movieIds" as an array' },
        { status: 400 },
      );
    }

    const movieIds = body.movieIds
      .filter((id): id is string => typeof id === "string" && Boolean(id.trim()))
      .slice(0, MAX_MOVIE_IDS);
    const suggestions = await suggestMovieCollections(movieIds);

    return NextResponse.json({ suggestions });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
