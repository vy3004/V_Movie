import "server-only";

import { redis } from "@/lib/redis";
import { Movie, MovieSource, PageMovieData, PageMoviesData } from "@/types";
import { dedupeMovies, getMovieDedupeKey } from "./movie-sources/dedupe";
import {
  ModalSearchCursor,
  ModalSearchResponse,
  MovieSourceProvider,
  MOVIE_SOURCES,
} from "./movie-sources/types";
import { withTimeout } from "./movie-sources/utils";
import { OphimProvider } from "./movie-sources/ophim.provider";
import { PhimApiProvider } from "./movie-sources/phimapi.provider";

const PROVIDERS: Record<MovieSource, MovieSourceProvider> = {
  ophim: OphimProvider,
  phimapi: PhimApiProvider,
};

const SEARCH_TIMEOUT = 2500;
const MODAL_SEARCH_TIMEOUT = 5000;
const ENRICH_TIMEOUT = 3000;
const MODAL_MAX_RETURNED = 200;
const MODAL_MAX_SEEN_KEYS = 200;
const FALLBACK_SEARCH_SOURCES: MovieSource[] = ["ophim", "phimapi"];

type PaginationWithTotalPages = PageMoviesData["params"]["pagination"] & {
  totalPages?: number;
};

function emptySearch(keyword: string, page: number, limit: number): PageMoviesData {
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

function initialCursor(sources: MovieSource[] = MOVIE_SOURCES): ModalSearchCursor {
  return {
    pages: { ophim: 1, phimapi: 1 },
    exhausted: {
      ophim: !sources.includes("ophim"),
      phimapi: !sources.includes("phimapi"),
    },
    seenKeys: [],
    returned: 0,
  };
}

function isMovieSource(value: string | null): value is MovieSource {
  return value === "ophim" || value === "phimapi";
}

export function normalizeMovieSource(value: string | null): MovieSource {
  return isMovieSource(value) ? value : "ophim";
}

function mergeEpisodes(base: Movie, extraMovies: Movie[]): Movie {
  const seenServers = new Set(
    (base.episodes || []).map(
      (server) => `${server.source || base.source}:${server.server_name}:${server.server_data.length}`,
    ),
  );
  const extraEpisodes = extraMovies.flatMap((movie) => movie.episodes || []).filter((server) => {
    const key = `${server.source}:${server.server_name}:${server.server_data.length}`;
    if (seenServers.has(key)) return false;
    seenServers.add(key);
    return server.server_data.length > 0;
  });

  return { ...base, episodes: [...(base.episodes || []), ...extraEpisodes] };
}

async function searchModalSources(
  keyword: string,
  cursor: ModalSearchCursor | null,
  limit: number,
  sources: MovieSource[],
  fallbackOnly = false,
): Promise<ModalSearchResponse> {
  const activeCursor = cursor || initialCursor(sources);
  const empty = emptySearch(keyword, 1, limit);
  if (activeCursor.returned >= MODAL_MAX_RETURNED) {
    return {
      ...empty,
      nextCursor: null,
      searchPhase: fallbackOnly ? "done" : undefined,
      isFallbackSearching: false,
    };
  }

  const activeSources = sources.filter((source) => !activeCursor.exhausted[source]);
  const results = await Promise.allSettled(
    activeSources.map((source) =>
      withTimeout(
        PROVIDERS[source].search(keyword, activeCursor.pages[source], limit),
        MODAL_SEARCH_TIMEOUT,
      ).then((data) => ({ source, data })),
    ),
  );

  const fetched = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  const seenSet = new Set(activeCursor.seenKeys);
  const items = dedupeMovies(
    fetched.flatMap(({ data }) => data.items || []),
    seenSet,
  ).slice(0, limit);
  const newSeenKeys = [...activeCursor.seenKeys, ...items.map(getMovieDedupeKey)].slice(
    -MODAL_MAX_SEEN_KEYS,
  );
  const nextCursor: ModalSearchCursor = {
    pages: { ...activeCursor.pages },
    exhausted: { ...activeCursor.exhausted },
    seenKeys: newSeenKeys,
    returned: activeCursor.returned + items.length,
    phase: fallbackOnly ? "fallback" : activeCursor.phase,
  };

  for (const { source, data } of fetched) {
    nextCursor.pages[source] += 1;
    const pagination = data.params?.pagination as PaginationWithTotalPages | undefined;
    const totalPages =
      pagination?.totalPages ||
      Math.ceil((pagination?.totalItems || 0) / (pagination?.totalItemsPerPage || limit));
    if (!pagination || nextCursor.pages[source] > totalPages || (data.items || []).length === 0) {
      nextCursor.exhausted[source] = true;
    }
  }

  const hasMore =
    nextCursor.returned < MODAL_MAX_RETURNED &&
    sources.some((source) => !nextCursor.exhausted[source]);

  return {
    ...empty,
    items,
    params: {
      ...empty.params,
      pagination: {
        totalItems: nextCursor.returned + (hasMore ? limit : 0),
        totalItemsPerPage: limit,
        currentPage: 1,
        pageRanges: 5,
      },
    },
    nextCursor: hasMore ? nextCursor : null,
    searchPhase: fallbackOnly ? (hasMore ? "fallback" : "done") : undefined,
    isFallbackSearching: fallbackOnly && hasMore,
  };
}

export const MovieAggregatorService = {
  async searchPage(keyword: string, page = 1, limit = 24): Promise<PageMoviesData> {
    const cacheKey = `search:all:${keyword}:${page}:${limit}`;
    if (redis) {
      const cached = await redis.get<PageMoviesData>(cacheKey);
      if (cached) return cached;
    }

    const results = await Promise.allSettled(
      MOVIE_SOURCES.map((source) =>
        withTimeout(PROVIDERS[source].search(keyword, page, limit), SEARCH_TIMEOUT),
      ),
    );
    const pages = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
    const items = dedupeMovies(pages.flatMap((data) => data.items || [])).slice(0, limit);
    const totalItems = pages.reduce(
      (sum, data) => sum + (data.params?.pagination?.totalItems || 0),
      0,
    );
    const base = pages[0] || emptySearch(keyword, page, limit);
    const response: PageMoviesData = {
      ...base,
      items,
      params: {
        ...base.params,
        pagination: {
          ...base.params.pagination,
          totalItems,
          totalItemsPerPage: limit,
          currentPage: page,
        },
      },
    };

    if (redis && items.length > 0) await redis.set(cacheKey, response, { ex: 3600 });
    return response;
  },

  async searchModal(
    keyword: string,
    cursor: ModalSearchCursor | null,
    limit = 10,
  ): Promise<ModalSearchResponse> {
    return searchModalSources(keyword, cursor, limit, MOVIE_SOURCES);
  },

  async searchModalFallback(
    keyword: string,
    cursor: ModalSearchCursor | null,
    limit = 10,
  ): Promise<ModalSearchResponse> {
    return searchModalSources(keyword, cursor, limit, FALLBACK_SEARCH_SOURCES, true);
  },

  async getDetail(slug: string, source: MovieSource = "ophim"): Promise<PageMovieData> {
    const cacheKey = `detail:base:${source}:${slug}`;
    if (redis) {
      const cached = await redis.get<PageMovieData>(cacheKey);
      if (cached) return cached;
    }

    const result = await PROVIDERS[source].getDetail(slug);
    if (redis && result.item) {
      const ttl = result.item.status === "ongoing" ? 600 : 86400;
      await redis.set(cacheKey, result, { ex: ttl });
    }
    return result;
  },

  async enrichEpisodes(slug: string, source: MovieSource = "ophim"): Promise<PageMovieData> {
    const base = await this.getDetail(slug, source);
    if (!base.item) return base;
    const cacheKey = `detail:episodes:${base.item.sourceKey || `${source}:${slug}`}`;
    if (redis) {
      const cached = await redis.get<PageMovieData>(cacheKey);
      if (cached) return cached;
    }

    const otherSources = MOVIE_SOURCES.filter((candidate) => candidate !== source);
    const results = await Promise.allSettled(
      otherSources.map((candidate) =>
        withTimeout(PROVIDERS[candidate].findCandidates(base.item!, 3), ENRICH_TIMEOUT),
      ),
    );
    const candidateMovies = results.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    );
    const baseKey = getMovieDedupeKey(base.item);
    const matched = candidateMovies.filter(
      (movie) => movie.source !== source && getMovieDedupeKey(movie) === baseKey,
    );
    const enrichedItem = mergeEpisodes(base.item, matched);
    const response = { ...base, item: enrichedItem };

    if (redis && enrichedItem.episodes.length > base.item.episodes.length) {
      const ttl = enrichedItem.status === "ongoing" ? 600 : 86400;
      await redis.set(cacheKey, response, { ex: ttl });
    }
    return response;
  },
};

