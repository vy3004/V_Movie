import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/services/admin-movie-indexer/admin.service";
import {
  deleteMovieCollectionItem,
  updateMovieCollectionItem,
} from "@/services/admin-movies/admin.service";

type RouteContext = {
  params: { itemId: string };
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || "Unknown movie collection item error");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  await requireAdminUser();

  try {
    const body = await req.json();
    if (!isObject(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const item = await updateMovieCollectionItem(params.itemId, body);
    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  await requireAdminUser();

  try {
    const result = await deleteMovieCollectionItem(params.itemId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
