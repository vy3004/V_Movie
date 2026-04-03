import { NextResponse } from "next/server";
import { fetchMoviesWithFallback } from "@/lib/apiClient";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  const limit = searchParams.get("limit") || "24";

  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  try {
    const data = await fetchMoviesWithFallback(slug, parseInt(limit));
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
