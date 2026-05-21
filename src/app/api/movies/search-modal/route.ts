import { NextResponse } from "next/server";
import { IndexedMovieService } from "@/services/indexed-movie.service";
import { MovieAggregatorService } from "@/services/movie-aggregator.service";
import { ModalSearchCursor } from "@/services/movie-sources/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get("keyword")?.trim() || "";
    const limit = parseInt(searchParams.get("limit") || "10", 10) || 10;
    const cursorParam = searchParams.get("cursor");
    const cursor = cursorParam ? (JSON.parse(cursorParam) as ModalSearchCursor) : null;

    if (keyword.length < 2) {
      return NextResponse.json(await IndexedMovieService.searchIndexedMoviesModal(keyword, limit, cursor));
    }

    if (cursor?.phase === "fallback") {
      return NextResponse.json(await MovieAggregatorService.searchModalFallback(keyword, cursor, limit));
    }

    return NextResponse.json(await IndexedMovieService.searchIndexedMoviesModal(keyword, limit, cursor));
  } catch (error) {
    console.error("[API_MOVIES_SEARCH_MODAL_GET]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
