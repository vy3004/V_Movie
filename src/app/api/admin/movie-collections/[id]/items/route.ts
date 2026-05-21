import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/services/admin-movie-indexer/admin.service";
import { addMovieCollectionItems } from "@/services/admin-movies/admin.service";

type RouteContext = {
  params: { id: string };
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || "Unknown movie collection item error");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  await requireAdminUser();

  try {
    const body = await req.json();
    if (!isObject(body) || !Array.isArray(body.items)) {
      return NextResponse.json(
        { error: 'Request body must include "items" as an array' },
        { status: 400 },
      );
    }

    const items = await addMovieCollectionItems(params.id, body.items);
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
