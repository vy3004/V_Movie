import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/services/admin-movie-indexer/admin.service";
import { updateMovieCollection } from "@/services/admin-movies/admin.service";

type RouteContext = {
  params: { id: string };
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || "Unknown movie collection error");
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

    const collection = await updateMovieCollection(params.id, {
      ...(body.slug !== undefined ? { slug: String(body.slug) } : {}),
      ...(body.name !== undefined ? { name: String(body.name) } : {}),
    });
    return NextResponse.json({ collection });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
