import { createClient } from "jsr:@supabase/supabase-js@2";

type MovieSource = "ophim" | "phimapi";
type Action = "insert" | "update" | "skip" | "review";
type AnyRecord = Record<string, unknown>;

const FUNCTION_TIMEOUT_MARGIN = 45000;
const PAGE_DELAY_MIN_MS = 8000;
const PAGE_DELAY_MAX_MS = 12000;
const SOURCE_URLS: Record<MovieSource, (page: number) => string> = {
  ophim: (page) =>
    `https://ophim1.com/v1/api/danh-sach/phim-moi-cap-nhat?page=${page}`,
  phimapi: (page) =>
    `https://phimapi.com/danh-sach/phim-moi-cap-nhat-v3?page=${page}`,
};
const PHIMAPI_IMAGE_BASE = "https://phimimg.com";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitterDelay() {
  return (
    PAGE_DELAY_MIN_MS +
    Math.floor(Math.random() * (PAGE_DELAY_MAX_MS - PAGE_DELAY_MIN_MS))
  );
}

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as AnyRecord)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeSearchText(value: string | null | undefined): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function parseEpisodeNumber(value: string | null | undefined): number {
  const text = normalizeSearchText(value);
  const numbers = text.match(/\d+/g)?.map(Number) || [];
  return numbers.length ? Math.max(...numbers) : 0;
}

function parseEpisodeState(value: string | null | undefined): string {
  const text = normalizeSearchText(value);
  if (!text) return "unknown";
  if (text.includes("trailer")) return "trailer";
  if (text === "full") return "full";
  if (text.includes("hoan tat") || text.includes("tron bo")) return "completed";
  if (/\d+/.test(text)) return "ongoing";
  return "unknown";
}

function buildSearchText(values: Array<string | null | undefined>): string {
  return Array.from(
    new Set(values.map(normalizeSearchText).filter(Boolean)),
  ).join(" ");
}

async function buildContentHash(
  input: Record<string, unknown>,
): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(input));
  const hash = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function buildDedupeKey(card: {
  normalized_origin_name: string;
  normalized_name: string;
  year: number | null;
  type: string;
}) {
  return [
    card.normalized_origin_name || card.normalized_name,
    card.year || "",
    card.type || "",
  ].join("|");
}

function parseListPage(source: MovieSource, raw: unknown) {
  const root = asRecord(raw);
  const data = asRecord(root.data);
  const imageBase =
    source === "ophim"
      ? ophimImageBase(
          asString(root.pathImage) ?? asString(data.APP_DOMAIN_CDN_IMAGE),
        )
      : PHIMAPI_IMAGE_BASE;

  return listItems(raw).flatMap((item) => {
    const slug = asString(item.slug);
    const name = asString(item.name) ?? asString(item.title);
    if (!slug || !name) return [];

    return [
      {
        source,
        slug,
        name,
        origin_name:
          asString(item.origin_name) ?? asString(item.original_name) ?? "",
        episode_current:
          asString(item.episode_current) ??
          asString(item.current_episode) ??
          asString(item.episode) ??
          asString(item.total_episodes) ??
          "",
        year: asNumber(item.year),
        type: asString(item.type) ?? "",
        status: asString(item.status),
        thumb_url: imageUrl(
          source === "phimapi"
            ? (item.poster_url ?? item.poster)
            : (item.thumb_url ?? item.thumb),
          imageBase,
        ),
        poster_url: imageUrl(
          source === "phimapi"
            ? (item.thumb_url ?? item.thumb)
            : (item.poster_url ?? item.poster),
          imageBase,
        ),
        quality: asString(item.quality),
        lang: asString(item.lang) ?? asString(item.language),
        category_slugs: slugList(item.category ?? item.categories),
        country_slugs: slugList(item.country ?? item.countries),
        season: asNumber(tmdbValue(item, "season")),
        vote_average: asNumber(tmdbValue(item, "vote_average")),
        vote_count: asNumber(tmdbValue(item, "vote_count")) ?? 0,
        updated_at: modifiedTime(item),
      },
    ];
  });
}

async function fetchSourceMovieCards(source: MovieSource, page: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(SOURCE_URLS[source](page), {
      signal: controller.signal,
    });
    if (!response.ok)
      throw new Error(
        `Failed to fetch ${source} page ${page}: ${response.status}`,
      );
    return parseListPage(source, await response.json());
  } finally {
    clearTimeout(timeoutId);
  }
}

async function buildMovie(
  card: ReturnType<typeof parseListPage>[number],
  existing?: AnyRecord,
) {
  const normalized_name = normalizeSearchText(card.name);
  const normalized_origin_name = normalizeSearchText(card.origin_name);
  const episode_number = parseEpisodeNumber(card.episode_current);
  const episode_state = parseEpisodeState(card.episode_current);
  const search_text = buildSearchText([
    existing?.search_text as string | undefined,
    card.name,
    card.origin_name,
  ]);
  const dedupe_key = buildDedupeKey({
    normalized_name,
    normalized_origin_name,
    year: card.year,
    type: card.type,
  });
  const sourceRef = {
    source: card.source,
    slug: card.slug,
    content_hash: await buildContentHash({
      source: card.source,
      slug: card.slug,
      episode_current: card.episode_current,
      updated_at: card.updated_at || "",
    }),
  };
  const existingSources = Array.isArray(existing?.sources)
    ? (existing.sources as AnyRecord[])
    : [];
  const sources = [
    ...existingSources.filter(
      (item) => !(item.source === card.source && item.slug === card.slug),
    ),
    sourceRef,
  ];
  const keepExistingEpisode =
    typeof existing?.episode_number === "number" &&
    existing.episode_number > episode_number;
  const merge_status =
    existing?.merge_status ??
    (card.category_slugs.includes("phim-18") ? "review" : "merged");

  const movie = {
    slug: existing?.slug || card.slug,
    name: card.name,
    origin_name: card.origin_name,
    normalized_name,
    normalized_origin_name,
    search_text,
    dedupe_key,
    year: card.year,
    type: card.type,
    status: card.status,
    thumb_url: card.thumb_url,
    poster_url: card.poster_url,
    episode_current: keepExistingEpisode
      ? existing?.episode_current
      : card.episode_current,
    episode_number: keepExistingEpisode
      ? existing?.episode_number
      : episode_number,
    episode_state: keepExistingEpisode
      ? existing?.episode_state
      : episode_state,
    season: card.season,
    quality: card.quality,
    lang: card.lang,
    category_slugs: card.category_slugs,
    country_slugs: card.country_slugs,
    source_vote_average: card.vote_average,
    source_vote_count: card.vote_count,
    vote_average: card.vote_average,
    vote_count: card.vote_count,
    popularity_score: card.vote_average
      ? card.vote_average * Math.log(card.vote_count + 1)
      : 0,
    sources,
    primary_source: card.source,
    primary_source_slug: card.slug,
    merge_status,
    last_synced_at: new Date().toISOString(),
  };

  return {
    ...movie,
    content_hash: await buildContentHash(movie),
  };
}

async function indexCard(
  supabase: ReturnType<typeof createClient>,
  card: ReturnType<typeof parseListPage>[number],
): Promise<Action> {
  const normalized_name = normalizeSearchText(card.name);
  const normalized_origin_name = normalizeSearchText(card.origin_name);
  const dedupe_key = buildDedupeKey({
    normalized_name,
    normalized_origin_name,
    year: card.year,
    type: card.type,
  });
  const { data: candidates, error: findError } = await supabase
    .from("movies")
    .select("*")
    .or(`dedupe_key.eq.${dedupe_key},slug.eq.${card.slug}`)
    .limit(10);

  if (findError) throw findError;
  const candidate =
    (candidates || []).find(
      (movie: AnyRecord) =>
        movie.slug === card.slug ||
        (Array.isArray(movie.sources) &&
          movie.sources.some(
            (source: AnyRecord) =>
              source.source === card.source && source.slug === card.slug,
          )),
    ) ?? (candidates || [])[0];
  const movie = await buildMovie(card, candidate);

  if (!candidate) {
    const { error } = await supabase.from("movies").insert(movie);
    if (error) throw error;
    return "insert";
  }

  const { error } = await supabase
    .from("movies")
    .update(movie)
    .eq("id", candidate.id);
  if (error) throw error;
  return "update";
}

Deno.serve(async (req) => {
  const startedAt = Date.now();
  const workerId = crypto.randomUUID();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { data: jobs, error: jobError } = await supabase
    .from("movie_index_jobs")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1);

  if (jobError) return new Response(jobError.message, { status: 500 });
  const job = jobs?.[0];
  if (!job) return new Response("Queue empty");

  await supabase
    .from("movie_index_jobs")
    .update({
      status: "running",
      locked_at: new Date().toISOString(),
      locked_by: workerId,
    })
    .eq("id", job.id);

  const summary: Record<Action, number> = {
    insert: 0,
    update: 0,
    skip: 0,
    review: 0,
  };

  try {
    for (let page = job.page_start; page <= job.page_end; page += 1) {
      if (Date.now() - startedAt > FUNCTION_TIMEOUT_MARGIN) break;
      if (job.source !== "ophim" && job.source !== "phimapi") continue;

      console.log(`[INDEXER] ${job.source} ${job.mode} page ${page}`);
      const cards = await fetchSourceMovieCards(job.source, page);
      for (const card of cards) {
        const action = await indexCard(supabase, card);
        summary[action] += 1;
      }
      await delay(jitterDelay());
    }

    await supabase
      .from("movie_index_jobs")
      .update({ status: "succeeded", updated_at: new Date().toISOString() })
      .eq("id", job.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await supabase
      .from("movie_index_jobs")
      .update({
        status: "failed",
        retry_count: job.retry_count + 1,
        last_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    return new Response(message, { status: 500 });
  }

  const { count } = await supabase
    .from("movie_index_jobs")
    .select("*", { count: "exact", head: true })
    .eq("status", "queued");

  if (count && count > 0) {
    const nextResponse = await fetch(req.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
      },
    });
    if (!nextResponse.ok) {
      console.error(
        `Failed to trigger next worker batch: ${nextResponse.status}`,
      );
    }
  } else {
    const appBaseUrl = Deno.env.get("APP_BASE_URL");
    const cronSecret = Deno.env.get("CRON_SECRET_SUPABASE");
    if (appBaseUrl && cronSecret) {
      const revalidateResponse = await fetch(
        `${appBaseUrl.replace(/\/+$/, "")}/api/cron/revalidate-home`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cronSecret}`,
            "Content-Type": "application/json",
          },
        },
      );
      if (!revalidateResponse.ok) {
        console.error(
          `Failed to revalidate home: ${revalidateResponse.status}`,
        );
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, summary }), {
    headers: { "Content-Type": "application/json" },
  });
});
