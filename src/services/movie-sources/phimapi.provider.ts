import axios from "axios";
import { WEB_TITLE } from "@/lib/configs";
import { Movie, PageMovieData, PageMoviesData } from "@/types";
import { MovieSourceProvider } from "./types";
import { prefixServerName } from "./utils";

const PHIMAPI_BASE = "https://phimapi.com";
const PHIMAPI_IMAGE_BASE = "https://phimimg.com";

function imageUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${PHIMAPI_IMAGE_BASE}/${url.replace(/^\/+/, "")}`;
}

function markMovie(movie: Movie): Movie {
  const tmdb = movie.tmdb || {
    type: movie.type || "",
    id: "",
    season: null,
    vote_average: 0,
    vote_count: 0,
  };

  return {
    ...movie,
    tmdb,
    imdb: movie.imdb || { id: "" },
    category: movie.category || [],
    country: movie.country || [],
    actor: movie.actor || [],
    director: movie.director || [],
    thumb_url: imageUrl(movie.poster_url || movie.thumb_url),
    poster_url: imageUrl(movie.thumb_url || movie.poster_url),
    source: "phimapi",
    sources: ["phimapi"],
    sourceSlug: movie.slug,
    sourceKey: `phimapi:${movie.slug}`,
    episodes: (movie.episodes || []).map((server) => ({
      ...server,
      source: "phimapi",
      server_name: prefixServerName("phimapi", server.server_name),
      server_data: (server.server_data || []).map((episode) => ({ ...episode, source: "phimapi" })),
    })),
  };
}

export const PhimApiProvider: MovieSourceProvider = {
  source: "phimapi",

  async search(keyword, page, limit): Promise<PageMoviesData> {
    const response = await axios.get(`${PHIMAPI_BASE}/v1/api/tim-kiem`, {
      params: { keyword, page, limit },
      timeout: 10000,
    });
    const apiData = response.data.data;

    return {
      items: (apiData.items || []).map(markMovie),
      params: apiData.params,
      titlePage: apiData.titlePage || `Tìm kiếm: ${keyword}`,
      breadCrumb: apiData.breadCrumb || [{ name: "Tìm kiếm", isCurrent: true, position: 1 }],
      seoOnPage: apiData.seoOnPage || {
        titleHead: `${WEB_TITLE} | Tìm kiếm phim ${keyword}`,
        descriptionHead: `Kết quả tìm kiếm cho từ khóa ${keyword}`,
        og_type: "website",
        og_image: [],
        og_url: "",
      },
    };
  },

  async getDetail(slug): Promise<PageMovieData> {
    const response = await axios.get(`${PHIMAPI_BASE}/phim/${slug}`, { timeout: 10000 });
    const raw = response.data;
    const item = markMovie({ ...raw.movie, episodes: raw.episodes || [] });

    return {
      item,
      params: { slug },
      breadCrumb: [{ name: item.name, isCurrent: true, position: 1 }],
      seoOnPage: {
        titleHead: `${WEB_TITLE} | ${item.name}`,
        descriptionHead: item.content || "",
        og_type: "video.movie",
        og_image: [item.poster_url || item.thumb_url].filter(Boolean),
        og_url: `/phim/${item.slug}?source=phimapi`,
      },
    };
  },

  async findCandidates(movie, limit = 5): Promise<Movie[]> {
    const result = await this.search(movie.origin_name || movie.name, 1, limit);
    const details = await Promise.allSettled(
      result.items.slice(0, limit).map((item) => this.getDetail(item.slug)),
    );
    return details.flatMap((detail) =>
      detail.status === "fulfilled" && detail.value.item ? [detail.value.item] : [],
    );
  },
};
