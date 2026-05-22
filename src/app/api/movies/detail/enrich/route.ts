import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  MovieAggregatorService,
  normalizeMovieSource,
} from "@/services/movie-aggregator.service";
import { MovieSource } from "@/types";

type SourceRef = { source?: string; slug?: string };

type IndexedMovieSourceRow = {
  slug: string;
  primary_source: MovieSource | null;
  primary_source_slug: string | null;
  sources: SourceRef[] | null;
};

async function getIndexedMovie(slug: string, source: MovieSource) {
  const columns = "slug, primary_source, primary_source_slug, sources";
  const { data, error } = await supabaseAdmin
    .from("movies")
    .select(columns)
    .eq("is_blocked", false)
    .or(`slug.eq.${slug},primary_source_slug.eq.${slug}`)
    .maybeSingle();

  if (error) throw error;
  if (data) return data as IndexedMovieSourceRow;

  const { data: sourceRows, error: sourceError } = await supabaseAdmin
    .from("movies")
    .select(columns)
    .eq("is_blocked", false)
    .filter("sources", "cs", JSON.stringify([{ slug }]));

  if (sourceError) throw sourceError;
  return (
    (sourceRows as IndexedMovieSourceRow[] | null)?.find((row) =>
      row.sources?.some(
        (item) =>
          item.slug === slug &&
          normalizeMovieSource(item.source || null) === source,
      ),
    ) || null
  );
}

function getSourceSlug(
  slug: string,
  source: MovieSource,
  row: IndexedMovieSourceRow,
) {
  if (row.primary_source === source && row.primary_source_slug) {
    return row.primary_source_slug;
  }

  return (
    row.sources?.find((item) => normalizeMovieSource(item.source || null) === source)
      ?.slug || slug
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");
    const source = normalizeMovieSource(searchParams.get("source"));

    if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

    const indexedMovie = await getIndexedMovie(slug, source);

    if (!indexedMovie) return NextResponse.json(null, { status: 404 });

    const sourceSlug = getSourceSlug(slug, source, indexedMovie);
    const data = await MovieAggregatorService.enrichEpisodes(sourceSlug, source);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[API_MOVIES_DETAIL_ENRICH_GET]:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
