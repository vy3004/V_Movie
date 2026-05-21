import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

const TOP_SEARCH_TTL_SECONDS = 60 * 60 * 24 * 7;

function topSearchKey() {
  return `search:selected-movies:daily:${new Date().toISOString().slice(0, 10)}`;
}

function topSearchKeys() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setUTCDate(today.getUTCDate() - 1);

  return [today, yesterday].map((date) => `search:selected-movies:daily:${date.toISOString().slice(0, 10)}`);
}

export async function GET(request: Request) {
  if (!redis) return NextResponse.json({ items: [] });

  const redisClient = redis;
  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit") || 10);
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 20)) : 10;
  const keys = topSearchKeys();
  const results = await Promise.all(
    keys.map((key) => redisClient.zrange<string[]>(key, 0, limit - 1, { rev: true })),
  );
  const seen = new Set<string>();
  const items = results
    .flat()
    .filter((keyword) => {
      if (seen.has(keyword)) return false;
      seen.add(keyword);
      return true;
    })
    .slice(0, limit);

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  if (!redis) return NextResponse.json({ ok: true });

  const body = (await request.json()) as { keyword?: unknown };
  const keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";
  if (keyword.length < 2) return NextResponse.json({ ok: true });

  const redisClient = redis;
  const key = topSearchKey();
  await redisClient.zincrby(key, 1, keyword.toLowerCase());
  const ttl = await redisClient.ttl(key);
  if (ttl === -1) await redisClient.expire(key, TOP_SEARCH_TTL_SECONDS);

  return NextResponse.json({ ok: true });
}
