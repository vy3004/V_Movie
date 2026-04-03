import { NextResponse } from "next/server";
import { fetchMovies } from "@/lib/apiClient";
import { typesMovie } from "@/lib/configs";

export async function GET() {
  try {
    const data = await fetchMovies(typesMovie.NEW.slug, {
      sort_field: "tmdb.vote_count",
    });
    return NextResponse.json(data.items);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch top movies" },
      { status: 500 },
    );
  }
}
