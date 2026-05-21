import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { MovieIndexerService } from "@/services/admin-movie-indexer/indexer.service";
import { SourceMovieCardInput } from "@/types/admin-movie-indexer";
import { MovieSource } from "@/types";

const DISCOVERED_LIMIT = 20;
const DISCOVERED_SOURCES: MovieSource[] = ["ophim", "phimapi"];
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX = 10;
const memoryRateLimit = new Map<string, { count: number; resetAt: number }>();

type DiscoveredMoviePayload = {
  source?: MovieSource;
  sourceSlug?: string;
  slug?: string;
  name?: string;
  origin_name?: string;
  episode_current?: string;
  year?: number | string | null;
  type?: string | null;
  thumb_url?: string | null;
  poster_url?: string | null;
  quality?: string | null;
  lang?: string | null;
  category?: Array<{ slug?: string }>;
  country?: Array<{ slug?: string }>;
};

function clientKey(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip") || "unknown";
}

async function isRateLimited(key: string): Promise<boolean> {
  if (redis) {
    const redisKey = `discovered:${key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.expire(redisKey, RATE_LIMIT_WINDOW_SECONDS);
    } else {
      const ttl = await redis.ttl(redisKey);
      if (ttl === -1) await redis.expire(redisKey, RATE_LIMIT_WINDOW_SECONDS);
    }
    return count > RATE_LIMIT_MAX;
  }

  const now = Date.now();
  const current = memoryRateLimit.get(key);
  if (!current || current.resetAt <= now) {
    memoryRateLimit.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_SECONDS * 1000 });
    return false;
  }

  current.count += 1;
  return current.count > RATE_LIMIT_MAX;
}

function toCard(movie: DiscoveredMoviePayload): SourceMovieCardInput | null {
  if (!movie.source || !DISCOVERED_SOURCES.includes(movie.source)) return null;
  const slug = movie.sourceSlug || movie.slug;
  if (!slug || !movie.name) return null;

  return {
    source: movie.source,
    slug,
    name: movie.name,
    origin_name: movie.origin_name,
    episode_current: movie.episode_current,
    year: movie.year,
    type: movie.type,
    thumb_url: movie.thumb_url,
    poster_url: movie.poster_url,
    quality: movie.quality,
    lang: movie.lang,
    category_slugs: (movie.category || []).map((item) => item.slug).filter(Boolean) as string[],
    country_slugs: (movie.country || []).map((item) => item.slug).filter(Boolean) as string[],
  };
}

export async function POST(request: Request) {
  try {
    if (await isRateLimited(clientKey(request))) {
      return NextResponse.json({ ok: false, error: "Rate limited" }, { status: 429 });
    }

    const body = (await request.json()) as { movies?: unknown[] };
    const movies = Array.isArray(body.movies) ? body.movies : [];
    const cards = movies
      .slice(0, DISCOVERED_LIMIT)
      .map((movie) => toCard(movie as DiscoveredMoviePayload))
      .filter((card): card is SourceMovieCardInput => Boolean(card));

    const results = await Promise.allSettled(cards.map((card) => MovieIndexerService.indexMovieCard(card)));
    const indexed = results.filter((result) => result.status === "fulfilled").length;

    return NextResponse.json({ ok: true, received: movies.length, queued: cards.length, indexed });
  } catch (error) {
    console.error("[API_MOVIES_DISCOVERED_POST]:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
