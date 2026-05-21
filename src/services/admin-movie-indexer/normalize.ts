import { IndexedSourceSnapshot, SourceMovieCardInput } from "@/types";
import { normalizeSearchText } from "@/services/movie-sources/utils";
import {
  buildContentHash,
  buildSearchText,
  buildSourceRef,
  parseEpisodeNumber,
  parseEpisodeState,
  parseNullableNumber,
} from "@/services/admin-movie-indexer/utils";

export { buildContentHash, buildSearchText, buildSourceRef, parseEpisodeNumber, parseEpisodeState };

export function buildDedupeKey(
  card: Pick<IndexedSourceSnapshot, "normalized_origin_name" | "normalized_name" | "year" | "type">,
): string {
  return [card.normalized_origin_name || card.normalized_name, card.year || "", card.type || ""].join("|");
}


export function buildIndexedSourceSnapshot(input: SourceMovieCardInput): IndexedSourceSnapshot {
  const normalized_name = normalizeSearchText(input.name);
  const normalized_origin_name = normalizeSearchText(input.origin_name || "");
  const year = input.year ? Number(input.year) || null : null;
  const type = input.type || "";
  const episode_current = input.episode_current || "";
  const episode_number = parseEpisodeNumber(episode_current);
  const episode_state = parseEpisodeState(episode_current);
  const season = parseNullableNumber(input.season);
  const source_vote_average = parseNullableNumber(input.vote_average);
  const source_vote_count = parseNullableNumber(input.vote_count) ?? 0;
  const search_text = buildSearchText([input.name, input.origin_name]);
  const base = {
    ...input,
    origin_name: input.origin_name || "",
    episode_current,
    year,
    type,
    normalized_name,
    normalized_origin_name,
    search_text,
    episode_number,
    episode_state,
    season,
    source_vote_average,
    source_vote_count,
    vote_average: source_vote_average,
    vote_count: source_vote_count,
    popularity_score: source_vote_average ? source_vote_average * Math.log(source_vote_count + 1) : 0,
  };

  return {
    ...base,
    dedupe_key: buildDedupeKey(base),
    content_hash: buildContentHash({
      source: input.source,
      slug: input.slug,
      name: input.name,
      origin_name: input.origin_name || "",
      year,
      type,
      episode_current,
      episode_state,
      season,
      vote_average: source_vote_average,
      vote_count: source_vote_count,
      thumb_url: input.thumb_url || "",
      poster_url: input.poster_url || "",
      updated_at: input.updated_at || "",
    }),
  };
}
