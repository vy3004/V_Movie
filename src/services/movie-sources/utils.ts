import { Episode, MovieSource, ServerData } from "@/types";

const SOURCE_BADGES: Record<MovieSource, string> = {
  ophim: "OP",
  phimapi: "PA",
};

export function getSourceBadge(source: MovieSource): string {
  return SOURCE_BADGES[source];
}

export function prefixServerName(source: MovieSource, serverName: string): string {
  const badge = getSourceBadge(source);
  if (serverName.startsWith(`${badge} - `)) return serverName;
  return `${badge} - ${serverName}`;
}

export function normalizeSearchText(value: string | null | undefined): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function getMovieHref(movie: { slug: string; source?: MovieSource }): string {
  if (!movie.source || movie.source === "ophim") return `/phim/${movie.slug}`;
  return `/phim/${movie.slug}?source=${movie.source}`;
}

export function getEpisodeProgressKey(
  episode: { name: string; slug: string } | null | undefined,
): string {
  if (!episode) return "";
  const normalizedName = normalizeSearchText(episode.name);
  const normalizedSlug = normalizeSearchText(episode.slug).replace(/\s+/g, "-");
  const rangeMatch = normalizedName.match(/(?:tap\s*)?(\d+)\s*[-â€“â€”]\s*(\d+)/);
  if (rangeMatch) return `${Number(rangeMatch[1])}-${Number(rangeMatch[2])}`;
  const numberMatch = normalizedName.match(/(?:tap\s*)?(\d+)/);
  if (numberMatch) return String(Number(numberMatch[1]));
  if (normalizedName === "full" || normalizedSlug === "full" || normalizedSlug === "tap-full") return "full";
  return episode.slug;
}

export function getEpisodeList(servers: Episode[]): ServerData[] {
  const byKey = new Map<string, ServerData>();
  for (const server of servers) {
    for (const episode of server.server_data) {
      const key = getEpisodeProgressKey(episode);
      if (!byKey.has(key)) byKey.set(key, episode);
    }
  }
  return Array.from(byKey.values());
}

export function getAvailableServersForEpisode(
  servers: Episode[],
  episodeKey: string,
): { server: Episode; idx: number }[] {
  return servers
    .map((server, idx) => ({ server, idx }))
    .filter(({ server }) =>
      episodeKey
        ? server.server_data.some(
            (episode) => getEpisodeProgressKey(episode) === episodeKey,
          )
        : server.server_data.length > 0,
    );
}

export function findEpisodeByKey(
  server: Episode | undefined,
  episodeKey: string,
): ServerData | undefined {
  return server?.server_data.find(
    (episode) => getEpisodeProgressKey(episode) === episodeKey,
  );
}

export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}



