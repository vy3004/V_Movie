import "server-only";

import { unstable_cache } from "next/cache";
import { redis } from "@/lib/redis";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getMovieDedupeKey } from "@/services/movie-sources/dedupe";
import {
  CateCtr,
  IndexedMovie,
  Movie,
  MovieQueryParams,
  MovieSource,
  PageMoviesData,
} from "@/types";
import {
  ModalSearchCursor,
  ModalSearchResponse,
} from "@/services/movie-sources/types";

const HOME_SELECT =
  "id, slug, name, origin_name, year, type, thumb_url, poster_url, episode_current, episode_number, episode_state, season, quality, lang, category_slugs, country_slugs, vote_average, vote_count, popularity_score, primary_source, primary_source_slug, last_synced_at";
const MODAL_SEARCH_CACHE_TTL = 60 * 10;

export type IndexedHomeMovie = Pick<
  IndexedMovie,
  | "id"
  | "slug"
  | "name"
  | "origin_name"
  | "year"
  | "type"
  | "thumb_url"
  | "poster_url"
  | "episode_current"
  | "episode_number"
  | "episode_state"
  | "season"
  | "quality"
  | "lang"
  | "category_slugs"
  | "country_slugs"
  | "vote_average"
  | "vote_count"
  | "popularity_score"
  | "primary_source"
  | "primary_source_slug"
  | "last_synced_at"
>;

export type IndexedSearchMovie = IndexedHomeMovie & {
  rank_score: number;
  total_count: number;
};

export type IndexedHomeResult = {
  items: IndexedHomeMovie[];
  movies: Movie[];
  durationMs: number;
};

function slugItems(slugs: string[]): CateCtr[] {
  return slugs.map((slug) => ({ slug, name: slug }));
}

export function indexedMovieToMovie(row: IndexedHomeMovie): Movie {
  return {
    tmdb: {
      type: row.type || "",
      id: "",
      season: row.season ? String(row.season) : null,
      vote_average: row.vote_average || 0,
      vote_count: row.vote_count || 0,
    },
    imdb: { id: "" },
    created: { time: row.last_synced_at || "" },
    modified: { time: row.last_synced_at || "" },
    _id: row.id,
    name: row.name,
    slug: row.slug,
    origin_name: row.origin_name || "",
    content: "",
    type: row.type || "",
    status: row.episode_state,
    thumb_url: row.thumb_url || "",
    poster_url: row.poster_url || row.thumb_url || "",
    trailer_url: "",
    is_copyright: false,
    sub_docquyen: false,
    chieurap: false,
    time: "",
    episode_current: row.episode_current || "",
    episode_total: row.episode_number ? String(row.episode_number) : "",
    quality: row.quality || "",
    lang: row.lang || "",
    year: row.year || 0,
    view: 0,
    actor: [],
    director: [],
    category: row.category_slugs ? slugItems(row.category_slugs) : [],
    country: row.country_slugs ? slugItems(row.country_slugs) : [],
    episodes: [],
    source: row.primary_source || undefined,
    sources: row.primary_source ? [row.primary_source] : [],
    sourceSlug: row.primary_source_slug || row.slug,
  };
}

function clampPage(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
}

function clampLimit(value: number): number {
  return Number.isFinite(value)
    ? Math.max(1, Math.min(48, Math.floor(value)))
    : 24;
}

function getModalSearchCacheKey(
  keyword: string,
  page: number,
  limit: number,
  includeSearchText: boolean,
) {
  const normalizedKeyword = keyword
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const phase = includeSearchText ? "text" : "name";
  return `search_modal:v1:${phase}:${limit}:${page}:${encodeURIComponent(normalizedKeyword)}`;
}

function emptySearchResult(
  keyword: string,
  page: number,
  limit: number,
): PageMoviesData {
  return {
    items: [],
    params: {
      type_slug: "tim-kiem",
      filterCategory: [],
      filterCountry: [],
      filterYear: "",
      filterType: "",
      sortField: "",
      sortType: "",
      pagination: {
        totalItems: 0,
        totalItemsPerPage: limit,
        currentPage: page,
        pageRanges: 5,
      },
    },
    titlePage: `Tìm kiếm: ${keyword}`,
    breadCrumb: [{ name: "Tìm kiếm", isCurrent: true, position: 1 }],
    seoOnPage: {
      titleHead: `V · Movie | Tìm kiếm phim ${keyword}`,
      descriptionHead: `Kết quả tìm kiếm cho từ khóa ${keyword}`,
      og_type: "website",
      og_image: [],
      og_url: "",
    },
  };
}

function toResult(
  data: IndexedHomeMovie[],
  durationMs: number,
): IndexedHomeResult {
  return {
    items: data,
    movies: data.map(indexedMovieToMovie),
    durationMs,
  };
}

function typeForSlug(slug: string): string | null {
  if (slug === "phim-le") return "single";
  if (slug === "phim-bo") return "series";
  if (slug === "hoat-hinh") return "hoathinh";
  if (slug === "tv-shows") return "tvshows";
  return null;
}

function titleForSlug(slug: string): string {
  if (slug === "phim-le") return "Phim lẻ";
  if (slug === "phim-bo") return "Phim bộ";
  if (slug === "hoat-hinh") return "Hoạt hình";
  if (slug === "tv-shows") return "TV Shows";
  return "Phim mới cập nhật";
}

function normalizeSort(sortField?: string): string {
  const allowed = new Set([
    "latest",
    "year_latest",
    "updated",
    "popular",
    "rating",
    "episode_number",
  ]);
  return allowed.has(sortField || "")
    ? sortField || "year_latest"
    : "year_latest";
}

function buildListSeo(
  slug: string,
  title: string,
): PageMoviesData["seoOnPage"] {
  return {
    titleHead: `V · Movie | ${title}`,
    descriptionHead: `Danh sách ${title.toLowerCase()} được cập nhật từ dữ liệu phim đã lập chỉ mục`,
    og_type: "website",
    og_image: [],
    og_url: `/${slug}`,
  };
}
export const HOME_SECTIONS = [
  { title: "Phim lẻ", slug: "phim-le" },
  { title: "Phim bộ", slug: "phim-bo" },
  { title: "TV Shows", slug: "tv-shows" },
  { title: "Hoạt hình", slug: "hoat-hinh" },
];

type HomeSectionRow = {
  slug: string;
  title: string;
  items: IndexedHomeMovie[];
};

type HomeRpcRow = {
  top_movies: IndexedHomeMovie[];
  sections: HomeSectionRow[];
};

type HomePagePayload = {
  latest: IndexedHomeResult;
  sections: Array<(typeof HOME_SECTIONS)[number] & { result: IndexedHomeResult }>;
};

export const IndexedMovieService = {
  async getHomePagePayload(
    year = new Date().getFullYear(),
    topLimit = 16,
    sectionLimit = 12,
  ): Promise<HomePagePayload> {
    const rpcParams = {
      target_year: year,
      top_limit: topLimit,
      section_limit: sectionLimit,
    };

    const getCachedData = unstable_cache(
      async () => {
        const { data, error } = await supabaseAdmin.rpc("get_homepage_movies", rpcParams);
        if (error) throw error;
        return data;
      },
      ['homepage-payload'], // Key
      {
        revalidate: 21600,
        tags: ['home-tag']
      }
    );

    const data = await getCachedData();
    const row = data as HomeRpcRow | null;
    if (!row) return { latest: toResult([], 0), sections: HOME_SECTIONS.map((section) => ({ ...section, result: toResult([], 0) })) };

    const topItems = Array.isArray(row.top_movies) ? row.top_movies : [];
    const latest = toResult(topItems, 0);

    const sectionMap = new Map(
      (Array.isArray(row.sections) ? row.sections : []).map((section) => [section.slug, section]),
    );

    const sections = HOME_SECTIONS.map((section) => {
      const matched = sectionMap.get(section.slug);
      const items = Array.isArray(matched?.items) ? matched.items : [];
      return {
        ...section,
        result: toResult(items, 0),
      };
    });

    return { latest, sections };
  },

  async listIndexedMovies(params: MovieQueryParams): Promise<PageMoviesData> {
    const slug = params.slug || "phim-moi-cap-nhat";
    const safePage = clampPage(Number(params.page || 1));
    const safeLimit = clampLimit(Number(params.limit || 24));
    const from = (safePage - 1) * safeLimit;
    const to = from + safeLimit - 1;
    const title = titleForSlug(slug);
    const sortField = normalizeSort(params.sort_field);

    let query = supabaseAdmin
      .from("movies")
      .select(HOME_SELECT, { count: "exact" })
      .eq("is_blocked", false);

    const type = params.type || typeForSlug(slug);
    if (type) query = query.eq("type", type);
    if (params.category)
      query = query.contains("category_slugs", [String(params.category)]);
    if (params.country)
      query = query.contains("country_slugs", [String(params.country)]);
    if (params.year) query = query.eq("year", Number(params.year));
    if (params.status) query = query.eq("episode_state", String(params.status));
    if (params.quality)
      query = query.ilike("quality", `%${String(params.quality)}%`);
    if (params.lang) query = query.ilike("lang", `%${String(params.lang)}%`);
    if (params.source)
      query = query.eq("primary_source", String(params.source));

    if (sortField === "updated") {
      query = query.order("last_synced_at", {
        ascending: false,
        nullsFirst: false,
      });
    } else if (sortField === "popular") {
      query = query.order("popularity_score", {
        ascending: false,
        nullsFirst: false,
      });
    } else if (sortField === "rating") {
      query = query.order("vote_average", {
        ascending: false,
        nullsFirst: false,
      });
    } else if (sortField === "episode_number") {
      query = query.order("episode_number", {
        ascending: false,
        nullsFirst: false,
      });
    } else {
      query = query
        .order("year", { ascending: false, nullsFirst: false })
        .order("last_synced_at", { ascending: false, nullsFirst: false });
    }

    const { data, error, count } = await query.range(from, to);
    if (error) throw error;

    return {
      items: ((data || []) as IndexedHomeMovie[]).map(indexedMovieToMovie),
      titlePage: title,
      breadCrumb: [{ name: title, isCurrent: true, position: 1 }],
      seoOnPage: buildListSeo(slug, title),
      params: {
        type_slug: slug,
        filterCategory: params.category ? [String(params.category)] : [],
        filterCountry: params.country ? [String(params.country)] : [],
        filterYear: params.year ? String(params.year) : "",
        filterType: type || "",
        sortField,
        sortType: "desc",
        pagination: {
          totalItems: count || 0,
          totalItemsPerPage: safeLimit,
          currentPage: safePage,
          pageRanges: 5,
        },
      },
    };
  },

  async searchIndexedMovies(
    keyword: string,
    page = 1,
    limit = 24,
  ): Promise<PageMoviesData> {
    const trimmedKeyword = keyword.trim();
    const safePage = clampPage(page);
    const safeLimit = clampLimit(limit);
    if (trimmedKeyword.length < 2)
      return emptySearchResult(trimmedKeyword, safePage, safeLimit);

    const { data, error } = await supabaseAdmin.rpc("search_movies", {
      search_keyword: trimmedKeyword,
      page_number: safePage,
      page_size: safeLimit,
    });

    if (error) throw error;

    const rows = (data || []) as IndexedSearchMovie[];
    const totalItems = Number(rows[0]?.total_count || 0);
    const result = emptySearchResult(trimmedKeyword, safePage, safeLimit);

    return {
      ...result,
      items: rows.map(indexedMovieToMovie),
      params: {
        ...result.params,
        pagination: {
          ...result.params.pagination,
          totalItems,
        },
      },
    };
  },

  async searchIndexedMoviesModal(
    keyword: string,
    limit = 10,
    cursor?: ModalSearchCursor | null,
  ): Promise<ModalSearchResponse> {
    const trimmedKeyword = keyword.trim();
    const safeLimit = clampLimit(limit);
    if (trimmedKeyword.length < 2) {
      return {
        ...emptySearchResult(trimmedKeyword, 1, safeLimit),
        nextCursor: null,
        searchPhase: "done",
        isFallbackSearching: false,
      };
    }

    const dbPage = cursor?.dbPage || 1;
    const includeSearchText = dbPage < 0;
    const searchPage = Math.abs(dbPage);
    const cacheKey =
      trimmedKeyword.length >= 3
        ? getModalSearchCacheKey(
          trimmedKeyword,
          searchPage,
          safeLimit,
          includeSearchText,
        )
        : null;
    let dbRows: IndexedSearchMovie[] | null = null;

    if (cacheKey && redis) {
      dbRows = await redis.get<IndexedSearchMovie[]>(cacheKey);
    }

    if (!dbRows) {
      const { data, error } = await supabaseAdmin.rpc("search_movies_modal", {
        search_keyword: trimmedKeyword,
        page_number: searchPage,
        page_size: safeLimit,
        include_search_text: includeSearchText,
      });

      if (error) throw error;
      dbRows = (data || []) as IndexedSearchMovie[];

      if (cacheKey && redis && dbRows.length > 0) {
        await redis.set(cacheKey, dbRows, { ex: MODAL_SEARCH_CACHE_TTL });
      }
    }

    const existingSeenKeys = cursor?.seenKeys || [];
    const rows = dbRows.filter((row) => {
      const key = getMovieDedupeKey(indexedMovieToMovie(row));
      return !existingSeenKeys.includes(key);
    });
    const hasMore = rows.length > safeLimit;
    const pageItems = rows.slice(0, safeLimit).map(indexedMovieToMovie);
    const returned = (cursor?.returned || 0) + pageItems.length;
    const seenKeys = [...existingSeenKeys, ...pageItems.map(getMovieDedupeKey)];
    const result = emptySearchResult(trimmedKeyword, searchPage, safeLimit);
    const fallbackCursor: ModalSearchCursor = {
      pages: { ophim: 1, phimapi: 1 },
      exhausted: { ophim: false, phimapi: false },
      seenKeys,
      returned,
      phase: "fallback",
    };

    const nextDbPage = includeSearchText ? -(searchPage + 1) : searchPage + 1;
    const nextCursor = hasMore
      ? {
        ...fallbackCursor,
        phase: "db" as const,
        dbPage: nextDbPage,
      }
      : includeSearchText
        ? fallbackCursor
        : {
          ...fallbackCursor,
          phase: "db" as const,
          dbPage: -1,
        };

    return {
      ...result,
      items: pageItems,
      nextCursor,
      searchPhase: includeSearchText ? "fallback" : "db",
      isFallbackSearching: includeSearchText,
      params: {
        ...result.params,
        pagination: {
          ...result.params.pagination,
          totalItems: hasMore ? returned + 1 : returned,
        },
      },
    };
  },

  getPrimarySource(movie: IndexedHomeMovie): {
    source: MovieSource | null;
    slug: string;
  } {
    return {
      source: movie.primary_source,
      slug: movie.primary_source_slug || movie.slug,
    };
  },
};
