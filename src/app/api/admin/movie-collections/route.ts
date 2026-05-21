import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/services/admin-movie-indexer/admin.service";
import {
  createMovieCollection,
  listMovieCollections,
} from "@/services/admin-movies/admin.service";

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || "Unknown movie collection error");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function GET(req: NextRequest) {
  await requireAdminUser();

  try {
    const collections = await listMovieCollections(
      req.nextUrl.searchParams.get("keyword") || "",
    );
    return NextResponse.json({ collections });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await requireAdminUser();

  try {
    const body = await req.json();
    if (!isObject(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const collection = await createMovieCollection({
      slug: String(body.slug || ""),
      name: String(body.name || ""),
    });
    return NextResponse.json({ collection });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
