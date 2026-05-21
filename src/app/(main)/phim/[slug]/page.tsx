import { cache, Suspense } from "react";
import { Metadata } from "next";

// Services
import { MovieService } from "@/services/movie.service";
import {
  MovieAggregatorService,
  normalizeMovieSource,
} from "@/services/movie-aggregator.service";
import { HistoryService } from "@/services/history.service";
import { MovieCollectionsService } from "@/services/movie-collections.service";
import { createSupabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Movie, MovieSource, PageMovieData } from "@/types";

// Components
import BreadCrumb from "@/components/layout/BreadCrumb";
import MovieDetail from "@/components/shared/MovieDetail";
import TrailerPlayer from "@/components/shared/TrailerPlayer";
import WatchMovie from "@/app/(main)/phim/[slug]/_components/WatchMovie";
import MovieCollectionSection from "./_components/MovieCollectionSection";
import SimilarMovies from "./_components/SimilarMovies";
import MovieNotFoundState from "./_components/MovieNotFoundState";

interface PageProps {
  params: { slug: string };
  searchParams: { tap?: string; source?: MovieSource; server?: string };
}

type SourceRef = { source?: string; slug?: string };

type IndexedMovieSourceRow = {
  id: string;
  slug: string;
  primary_source: MovieSource | null;
  primary_source_slug: string | null;
  sources: SourceRef[] | null;
};

const getIndexedMovieRow = cache(async (slug: string) => {
  try {
    const { data } = await supabaseAdmin
      .from("movies")
      .select("id, slug, primary_source, primary_source_slug, sources")
      .eq("slug", slug)
      .eq("is_blocked", false)
      .maybeSingle();

    return data as IndexedMovieSourceRow | null;
  } catch (error) {
    console.error(`[MoviePage] Failed to load indexed row for ${slug}`, error);
    return null;
  }
});

function getSourcesByPriority(
  requestedSource: MovieSource | null,
  row: IndexedMovieSourceRow | null,
): MovieSource[] {
  const sources = new Set<MovieSource>();

  if (requestedSource) sources.add(requestedSource);
  if (!requestedSource && row?.primary_source) sources.add(row.primary_source);
  row?.sources?.forEach((item) => {
    const source = normalizeMovieSource(item.source || null);
    sources.add(source);
  });
  sources.add("ophim");
  sources.add("phimapi");

  return Array.from(sources);
}

function getSourceSlug(
  slug: string,
  source: MovieSource,
  row: IndexedMovieSourceRow | null,
) {
  if (row?.primary_source === source && row.primary_source_slug) {
    return row.primary_source_slug;
  }

  return row?.sources?.find((item) => item.source === source)?.slug || slug;
}

function hasUsableMovieDetail(
  movie:
    | {
        name?: string;
        origin_name?: string;
        slug?: string;
        thumb_url?: string;
        poster_url?: string;
        content?: string;
      }
    | null
    | undefined,
) {
  if (!movie) return false;
  return Boolean(
    movie.name?.trim() ||
    movie.origin_name?.trim() ||
    movie.thumb_url?.trim() ||
    movie.poster_url?.trim() ||
    movie.content?.trim(),
  );
}

const getMovieDetail = cache(
  async (
    slug: string,
    requestedSource: MovieSource | null,
    row: IndexedMovieSourceRow | null,
  ) => {
    const sources = getSourcesByPriority(requestedSource, row);

    for (const source of sources) {
      const sourceSlug = getSourceSlug(slug, source, row);
      try {
        const data = await MovieService.getDetail(sourceSlug, source);
        if (hasUsableMovieDetail(data?.item)) return data;
      } catch (error) {
        console.error(
          `[MoviePage] Failed to load ${source}:${sourceSlug}`,
          error,
        );
      }
    }

    return null;
  },
);

/**
 * Tạo Metadata động cho SEO
 */
export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const requestedSource = searchParams.source
    ? normalizeMovieSource(searchParams.source)
    : null;
  const indexedMovie = await getIndexedMovieRow(params.slug);
  const data = await getMovieDetail(params.slug, requestedSource, indexedMovie);

  if (!data || !hasUsableMovieDetail(data.item)) {
    return { title: "Không tìm thấy phim" };
  }

  const { seoOnPage } = data;
  if (!seoOnPage) return { title: data.item?.name || "Chi tiết phim" };

  const tap = searchParams.tap;

  const title = tap
    ? `${seoOnPage.titleHead} | Tập ${tap}`
    : seoOnPage.titleHead;

  return {
    title: title,
    description: seoOnPage.descriptionHead,
    openGraph: {
      title: title,
      description: seoOnPage.descriptionHead,
      images: seoOnPage.og_image,
      url: seoOnPage.og_url,
      type: "video.movie",
    },
    alternates: {
      canonical: seoOnPage.og_url,
    },
  };
}

export default async function MoviePage({ params, searchParams }: PageProps) {
  const { slug } = params;
  const requestedSource = searchParams.source
    ? normalizeMovieSource(searchParams.source)
    : null;

  const supabase = await createSupabaseServer();
  const [{ data: authData }, indexedMovie] = await Promise.all([
    supabase.auth.getUser(),
    getIndexedMovieRow(slug),
  ]);
  const user = authData?.user;

  const data = await getMovieDetail(slug, requestedSource, indexedMovie);
  const movie = data?.item;

  if (!hasUsableMovieDetail(movie)) {
    return <MovieNotFoundState />;
  }

  const validData = data as PageMovieData;
  const validMovie = movie as Movie;
  let playableMovie = validMovie;

  const hasPlayableEpisodes = (candidate: Movie) =>
    candidate.episodes?.some((server) =>
      server.server_data?.some((ep) => ep.slug !== "" && ep.link_m3u8 !== ""),
    );

  let hasValidEpisodes = hasPlayableEpisodes(playableMovie);
  if (!hasValidEpisodes) {
    const source = playableMovie.source || requestedSource || "ophim";
    const sourceSlug = getSourceSlug(slug, source, indexedMovie);
    try {
      const enrichedData = await MovieAggregatorService.enrichEpisodes(
        sourceSlug,
        source,
      );
      if (enrichedData.item) {
        playableMovie = enrichedData.item;
        hasValidEpisodes = hasPlayableEpisodes(playableMovie);
      }
    } catch (error) {
      console.error(
        `[MoviePage] Failed to enrich ${source}:${sourceSlug}`,
        error,
      );
    }
  }

  let history = null;
  if (hasValidEpisodes && user) {
    try {
      history = await HistoryService.getLatest(user.id, slug);
    } catch (error) {
      console.error(`[MoviePage] Failed to load history for ${slug}`, error);
    }
  }

  let collection = null;
  if (indexedMovie?.id) {
    try {
      collection = await MovieCollectionsService.getForMovieId(indexedMovie.id);
    } catch (error) {
      console.error(`[MoviePage] Failed to load collection for ${slug}`, error);
    }
  }

  return (
    <div className="col-span-12 xl:col-span-8 py-4 space-y-4 sm:space-y-8 animate-in fade-in duration-500">
      <BreadCrumb breadCrumb={validData.breadCrumb} />

      <MovieDetail movie={validMovie} />

      <MovieCollectionSection collection={collection} />

      {hasValidEpisodes ? (
        <WatchMovie movie={playableMovie} history={history} user={user} />
      ) : (
        <TrailerPlayer movie={validMovie} user={user} />
      )}

      <Suspense fallback={null}>
        <SimilarMovies
          currentSlug={validMovie.slug}
          typeSlug={validMovie.type}
          genres={validMovie.category}
          countries={validMovie.country}
        />
      </Suspense>

      {validData.seoOnPage?.seoSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(validData.seoOnPage.seoSchema).replace(
              /<\/script/gi,
              "<\\/script",
            ),
          }}
        />
      )}
    </div>
  );
}





