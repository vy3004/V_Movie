import crypto from "crypto";

import { EpisodeState, IndexedMovieSourceRef, IndexedSourceSnapshot } from "@/types";
import { normalizeSearchText } from "@/services/movie-sources/utils";

export function parseEpisodeNumber(value: string | null | undefined): number {
  const text = normalizeSearchText(value);
  const numbers = text.match(/\d+/g)?.map(Number) || [];
  return numbers.length ? Math.max(...numbers) : 0;
}

export function parseEpisodeState(value: string | null | undefined): EpisodeState {
  const text = normalizeSearchText(value);
  if (!text) return "unknown";
  if (text.includes("trailer")) return "trailer";
  if (text === "full") return "full";
  if (text.includes("hoan tat") || text.includes("tron bo")) return "completed";
  if (/\d+/.test(text)) return "ongoing";
  return "unknown";
}

export function parseNullableNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function buildSearchText(values: Array<string | null | undefined>): string {
  return Array.from(new Set(values.map(normalizeSearchText).filter(Boolean))).join(" ");
}

export function buildContentHash(input: Record<string, unknown>): string {
  return crypto.createHash("sha1").update(JSON.stringify(input)).digest("hex");
}

export function buildSourceRef(snapshot: IndexedSourceSnapshot): IndexedMovieSourceRef {
  return {
    source: snapshot.source,
    slug: snapshot.slug,
    content_hash: snapshot.content_hash,
  };
}
