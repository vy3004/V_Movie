import axios from "axios";
import { BASE_MOVIE_API, MOVIE_IMG_PATH, WEB_TITLE } from "@/lib/configs";
import { Movie, PageMovieData, PageMoviesData } from "@/types";
import { MovieSourceProvider } from "./types";
import { prefixServerName } from "./utils";

function imageUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${MOVIE_IMG_PATH}${url.replace(/^\/+/, "")}`;
}

function markMovie(movie: Movie): Movie {
  return {
    ...movie,
    tmdb: movie.tmdb || {
      type: movie.type || "",
      id: "",
      season: null,
      vote_average: 0,
      vote_count: 0,
    },
    imdb: movie.imdb || { id: "" },
    category: movie.category || [],
    country: movie.country || [],
    actor: movie.actor || [],
    director: movie.director || [],
    thumb_url: imageUrl(movie.thumb_url),
    poster_url: imageUrl(movie.poster_url),
    source: "ophim",
    sources: ["ophim"],
    sourceSlug: movie.slug,
    sourceKey: `ophim:${movie.slug}`,
    episodes: (movie.episodes || []).map((server) => ({
      ...server,
      source: "ophim",
      server_name: prefixServerName("ophim", server.server_name),
      server_data: (server.server_data || []).map((episode) => ({ ...episode, source: "ophim" })),
    })),
  };
}

export const OphimProvider: MovieSourceProvider = {
  source: "ophim",

  async search(keyword, page, limit): Promise<PageMoviesData> {
    const response = await axios.get(`${BASE_MOVIE_API}/tim-kiem`, {
      params: { keyword, page, limit },
      timeout: 10000,
    });
    const apiData = response.data.data;

    return {
      items: (apiData.items || []).map(markMovie),
      params: apiData.params || {
        type_slug: "tim-kiem",
        filterCategory: [],
        filterCountry: [],
        filterYear: "",
        filterType: "",
        sortField: "",
        sortType: "",
        pagination: { totalItems: 0, totalItemsPerPage: limit, currentPage: page, pageRanges: 5 },
      },
      titlePage: `Tìm kiếm: ${keyword}`,
      breadCrumb: [{ name: "Tìm kiếm", isCurrent: true, position: 1 }],
      seoOnPage: {
        titleHead: `${WEB_TITLE} | Tìm kiếm phim ${keyword}`,
        descriptionHead: `Kết quả tìm kiếm cho từ khóa ${keyword}`,
        og_type: "website",
        og_image: [],
        og_url: "",
      },
    };
  },

  async getDetail(slug): Promise<PageMovieData> {
    const { data } = await axios.get(`${BASE_MOVIE_API}/phim/${slug}`);
    const item = data.data?.item ? markMovie(data.data.item) : null;
    return {
      ...data.data,
      item,
      seoOnPage: {
        ...data.data.seoOnPage,
        titleHead: `${WEB_TITLE} | ${data.data.seoOnPage?.titleHead || ""}`,
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
