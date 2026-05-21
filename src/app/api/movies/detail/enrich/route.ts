import { NextResponse } from "next/server";
import {
  MovieAggregatorService,
  normalizeMovieSource,
} from "@/services/movie-aggregator.service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");
    const source = normalizeMovieSource(searchParams.get("source"));

    if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

    const data = await MovieAggregatorService.enrichEpisodes(slug, source);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[API_MOVIES_DETAIL_ENRICH_GET]:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
