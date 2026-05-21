import { MovieSource, SourceMovieCardInput } from "@/types";

type AnyRecord = Record<string, unknown>;
type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Pick<Response, "ok" | "json" | "status">>;

const SOURCE_URLS: Record<MovieSource, (page: number) => string> = {
  ophim: (page) => `https://ophim1.com/v1/api/danh-sach/phim-moi-cap-nhat?page=${page}`,
  phimapi: (page) => `https://phimapi.com/danh-sach/phim-moi-cap-nhat-v3?page=${page}`,
};

const PHIMAPI_IMAGE_BASE = "https://phimimg.com";

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as AnyRecord) : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asYear(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function slugList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(asRecord(item).slug) ?? asString(item))
    .filter((slug): slug is string => Boolean(slug));
}

function imageUrl(value: unknown, baseUrl: string | null): string | null {
  const url = asString(value);
  if (!url) return null;
  if (url.startsWith("http")) return url;
  if (!baseUrl) return url;
  return `${baseUrl.replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`;
}

function ophimImageBase(rawBase: string | null): string | null {
  if (!rawBase) return null;
  const base = rawBase.replace(/\/+$/, "");
  return base.endsWith("/uploads/movies") ? base : `${base}/uploads/movies`;
}

function listItems(raw: unknown): AnyRecord[] {
  const root = asRecord(raw);
  const data = asRecord(root.data);
  const items = root.items ?? data.items ?? root.movies ?? data.movies;
  return Array.isArray(items) ? items.map(asRecord) : [];
}

function modifiedTime(item: AnyRecord): string | null {
  return (
    asString(asRecord(item.modified).time) ??
    asString(item.modified) ??
    asString(item.updated_at) ??
    asString(item.updatedAt) ??
    asString(item.modified_time)
  );
}

function tmdbValue(item: AnyRecord, key: string): unknown {
  return asRecord(item.tmdb)[key] ?? item[key];
}

function parseListPage(source: MovieSource, raw: unknown): SourceMovieCardInput[] {
  const root = asRecord(raw);
  const data = asRecord(root.data);
  const imageBase = source === "ophim" ? ophimImageBase(asString(root.pathImage) ?? asString(data.APP_DOMAIN_CDN_IMAGE)) : source === "phimapi" ? PHIMAPI_IMAGE_BASE : null;

  return listItems(raw).flatMap((item) => {
    const slug = asString(item.slug);
    const name = asString(item.name) ?? asString(item.title);
    if (!slug || !name) return [];

    return [
      {
        source,
        slug,
        name,
        origin_name: asString(item.origin_name) ?? asString(item.original_name),
        episode_current:
          asString(item.episode_current) ??
          asString(item.current_episode) ??
          asString(item.episode) ??
          asString(item.total_episodes),
        year: asYear(item.year),
        type: asString(item.type),
        status: asString(item.status),
        thumb_url: imageUrl(source === "phimapi" ? item.poster_url ?? item.poster : item.thumb_url ?? item.thumb, imageBase),
        poster_url: imageUrl(source === "phimapi" ? item.thumb_url ?? item.thumb : item.poster_url ?? item.poster, imageBase),
        quality: asString(item.quality),
        lang: asString(item.lang) ?? asString(item.language),
        category_slugs: slugList(item.category ?? item.categories),
        country_slugs: slugList(item.country ?? item.countries),
        season: asYear(tmdbValue(item, "season")),
        vote_average: asYear(tmdbValue(item, "vote_average")),
        vote_count: asYear(tmdbValue(item, "vote_count")),
        updated_at: modifiedTime(item),
      } satisfies SourceMovieCardInput,
    ];
  });
}

export function parseOphimListPage(raw: unknown): SourceMovieCardInput[] {
  return parseListPage("ophim", raw);
}

export function parsePhimApiListPage(raw: unknown): SourceMovieCardInput[] {
  return parseListPage("phimapi", raw);
}


export async function fetchSourceMovieCards(
  source: MovieSource,
  page: number,
  fetchImpl: FetchLike = fetch,
  timeoutMs = 30000,
): Promise<SourceMovieCardInput[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(SOURCE_URLS[source](page), {
      signal: controller.signal,
    });
    if (!response.ok)
      throw new Error(`Failed to fetch ${source} page ${page}: ${response.status}`);

    const raw = await response.json();
    if (source === "ophim") return parseOphimListPage(raw);
    if (source === "phimapi") return parsePhimApiListPage(raw);
    throw new Error(`Unsupported movie source: ${source}`);
  } finally {
    clearTimeout(timeoutId);
  }
}



