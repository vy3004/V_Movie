import "server-only";

import axios from "axios";
import { redis } from "@/lib/redis";
import { BASE_MOVIE_API, WEB_TITLE } from "@/lib/configs";
import {
  PageMovieData,
  PageMoviesData,
  MovieQueryParams,
  CateCtr,
  Movie,
} from "@/types";

/**
 * Interface cho dữ liệu Metadata trả về
 */
interface MetadataResponse {
  categories: CateCtr[];
  countries: CateCtr[];
}

/**
 * Hàm tạo Cache Key duy nhất (Sắp xếp keys và loại bỏ giá trị rỗng để tối ưu tỷ lệ Hit-Cache)
 */
const getCacheKey = (
  prefix: string,
  params: Record<string, unknown> = {},
): string => {
  const sortedParams = Object.entries(params)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .reduce((obj: Record<string, unknown>, [key, value]) => {
      // Chỉ băm những param có giá trị thực (bỏ qua undefined, null, chuỗi rỗng)
      if (value !== undefined && value !== null && value !== "") {
        obj[key] = value;
      }
      return obj;
    }, {});
  const queryStr = Buffer.from(JSON.stringify(sortedParams)).toString("base64");
  return `${prefix}:${queryStr}`;
};

export const MovieService = {
  /**
   * 1. Lấy chi tiết phim (Dynamic Cache 10m - 24h)
   */
  getDetail: async (slug: string): Promise<PageMovieData> => {
    const cacheKey = `detail:${slug}`;
    if (redis) {
      const cached = await redis.get<PageMovieData>(cacheKey);
      if (cached) return cached;
    }

    try {
      const { data } = await axios.get(`${BASE_MOVIE_API}/phim/${slug}`);
      const result: PageMovieData = {
        ...data.data,
        seoOnPage: {
          ...data.data.seoOnPage,
          titleHead: `${WEB_TITLE} | ${data.data.seoOnPage?.titleHead || ""}`,
        },
      };

      if (redis && result.item) {
        // Phim đang chiếu (ongoing) cache 10 phút, phim hoàn thành (completed) cache 24h
        const isOngoing = result.item.status === "ongoing";
        const ttl = isOngoing ? 600 : 86400;

        await redis.set(cacheKey, result, { ex: ttl });
      }
      return result;
    } catch (error) {
      console.error(
        `[MovieService.getDetail] Error fetching slug: ${slug}`,
        error,
      );
      throw error;
    }
  },

  /**
   * 2. Lấy danh sách phim đa bộ lọc + Logic Fallback (Cache 2h)
   */
  getList: async (params: MovieQueryParams): Promise<PageMoviesData> => {
    const {
      slug = "phim-moi-cap-nhat",
      page = 1,
      limit = 24,
      ...filters
    } = params;

    // Ép kiểu object literal bằng spread operator để thỏa mãn Record<string, unknown>
    const cacheKey = getCacheKey(`movies:${slug}`, { ...params });

    if (redis) {
      const cached = await redis.get<PageMoviesData>(cacheKey);
      if (cached) return cached;
    }

    const currentYear = new Date().getFullYear().toString();
    const previousYear = (new Date().getFullYear() - 1).toString();

    try {
      // Logic gọi API v1 (Hỗ trợ lọc category/country/year)
      const fetchFromApi = async (yearValue?: string | number) => {
        const apiParams: Record<string, unknown> = {
          page,
          limit,
          ...filters,
          year: filters.year || yearValue,
        };
        const url = `${BASE_MOVIE_API}/danh-sach/${slug}`;
        const response = await axios.get(url, { params: apiParams });
        return response.data.data;
      };

      // BƯỚC 1: Lấy dữ liệu năm hiện tại (hoặc năm yêu cầu)
      const apiData = await fetchFromApi(
        filters.year ? undefined : currentYear,
      );

      // BƯỚC 2: Logic Fallback (Vét phim năm trước nếu không đủ số lượng limit)
      // Chỉ áp dụng khi slug là phim-bo/phim-le/hoat-hinh và user không yêu cầu năm cụ thể
      const isListType = ["phim-bo", "phim-le", "hoat-hinh"].includes(slug);
      if (isListType && !filters.year && apiData.items.length < limit) {
        const prevData = await fetchFromApi(previousYear);
        const needed = Number(limit) - apiData.items.length;
        apiData.items = [...apiData.items, ...prevData.items.slice(0, needed)];
      }

      const result: PageMoviesData = {
        items: apiData.items || [],
        params: apiData.params,
        titlePage: apiData.titlePage || "Danh sách phim",
        breadCrumb: apiData.breadCrumb || [],
        seoOnPage: {
          ...apiData.seoOnPage,
          titleHead: `${WEB_TITLE} | ${apiData.seoOnPage?.titleHead || ""}`,
        },
      };

      if (redis && result.items.length > 0) {
        await redis.set(cacheKey, result, { ex: 7200 }); // Cache 2 tiếng
      }

      return result;
    } catch (error) {
      console.error(
        `[MovieService.getList] Error fetching list for slug: ${slug}`,
        error,
      );
      throw error;
    }
  },

  /**
   * 3. Tìm kiếm phim (Hàm chuyên dụng cho Endpoint /v1/api/tim-kiem)
   */
  search: async (
    keyword: string,
    page: number = 1,
    limit: number = 24,
  ): Promise<PageMoviesData> => {
    // Truyền object literal thuần túy
    const cacheKey = getCacheKey("search", { keyword, page, limit });

    if (redis) {
      const cached = await redis.get<PageMoviesData>(cacheKey);
      if (cached) return cached;
    }

    try {
      const response = await axios.get(`${BASE_MOVIE_API}/tim-kiem`, {
        params: { keyword, page, limit },
        timeout: 10000,
      });

      const apiData = response.data.data;

      // MAPPING AN TOÀN: OPhim Search API thường thiếu thông tin SEO
      const result: PageMoviesData = {
        items: apiData.items || [],
        params: apiData.params || {
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
          titleHead: `${WEB_TITLE} | Tìm kiếm phim ${keyword}`,
          descriptionHead: `Kết quả tìm kiếm cho từ khóa ${keyword}`,
          og_type: "website",
          og_image: [],
          og_url: "",
        },
      };

      if (redis && result.items.length > 0) {
        await redis.set(cacheKey, result, { ex: 3600 }); // Cache tìm kiếm 1 tiếng
      }
      return result;
    } catch (error) {
      console.error(
        `[MovieService.search] Error with keyword: ${keyword}`,
        error,
      );
      throw error;
    }
  },

  /**
   * 4. Lấy Metadata (Thể loại & Quốc gia - Cache Vĩnh cửu 30 ngày)
   */
  getMetadata: async (): Promise<{
    data: MetadataResponse;
    source: "HIT-REDIS" | "MISS" | "ERROR";
  }> => {
    const cacheKey = "metadata:all";
    const THIRTY_DAYS = 2592000; // 30 * 24 * 60 * 60 giây

    if (redis) {
      const cached = await redis.get<MetadataResponse>(cacheKey);
      if (cached) return { data: cached, source: "HIT-REDIS" };
    }

    try {
      const [catsRes, countriesRes] = await Promise.all([
        axios.get(`${BASE_MOVIE_API}/the-loai`),
        axios.get(`${BASE_MOVIE_API}/quoc-gia`),
      ]);

      const metadata: MetadataResponse = {
        categories: catsRes.data.data?.items || [],
        countries: countriesRes.data.data?.items || [],
      };

      if (redis && metadata.categories.length > 0) {
        await redis.set(cacheKey, metadata, { ex: THIRTY_DAYS });
      }

      return { data: metadata, source: "MISS" };
    } catch (error) {
      console.error(
        "[MovieService.getMetadata] Error fetching metadata",
        error,
      );
      return { data: { categories: [], countries: [] }, source: "ERROR" };
    }
  },
  /**
   * 5. Lấy phim theo Thể loại (Chuyên dụng cho Fallback AI Recommend)
   */
  getByGenre: async (
    genreSlug: string,
    page: number = 1,
    limit: number = 12,
  ): Promise<PageMoviesData> => {
    // Cố định sortField để lấy phim có nhiều lượt vote nhất
    const sortField = "tmdb.vote_count";
    const cacheKey = getCacheKey("genre", {
      genreSlug,
      page,
      limit,
      sortField,
    });

    if (redis) {
      const cached = await redis.get<PageMoviesData>(cacheKey);
      if (cached) return cached;
    }

    try {
      const response = await axios.get(
        `${BASE_MOVIE_API}/the-loai/${genreSlug}`,
        {
          params: { page, limit, sortField },
          timeout: 10000,
        },
      );

      const apiData = response.data.data;

      console.log(`Fetched movies for genre "${genreSlug}" from API:`, apiData);

      const result: PageMoviesData = {
        items: apiData.items || [],
        params: apiData.params || {
          type_slug: genreSlug,
          filterCategory: [genreSlug],
          filterCountry: [],
          filterYear: "",
          filterType: "",
          sortField: sortField,
          sortType: "desc",
          pagination: {
            totalItems: 0,
            totalItemsPerPage: limit,
            currentPage: page,
            pageRanges: 5,
          },
        },
        titlePage: apiData.titlePage || `Thể loại: ${genreSlug}`,
        breadCrumb: apiData.breadCrumb || [],
        seoOnPage: {
          ...apiData.seoOnPage,
          titleHead: `${WEB_TITLE} | Thể loại ${genreSlug}`,
        },
      };

      // Cache lại 2 tiếng
      if (redis && result.items.length > 0) {
        await redis.set(cacheKey, result, { ex: 7200 });
      }
      return result;
    } catch (error) {
      console.error(
        `[MovieService.getByGenre] Error with genreSlug: ${genreSlug}`,
        error,
      );
      throw error;
    }
  },
  /**
   * 6. Lấy phim tương tự (Lọc 2 lớp)
   */
  getSimilarMovies: async (
    currentSlug: string,
    typeSlug: string, // 'phim-bo' hoặc 'phim-le' hoặc 'hoat-hinh'
    genres: { slug: string; name?: string }[],
    countries: { slug: string; name?: string }[],
    limit: number = 12,
  ): Promise<Movie[]> => {
    if (!genres || genres.length === 0) return [];

    const cacheKey = `similar_movies:${currentSlug}`;
    if (redis) {
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        return (
          typeof cachedData === "string" ? JSON.parse(cachedData) : cachedData
        ) as Movie[];
      }
    }

    try {
      const similarMovies: Movie[] = [];
      const seenSlugs = new Set<string>([currentSlug]);

      const primaryGenre = genres[0]?.slug;
      const primaryCountry =
        countries && countries.length > 0 ? countries[0].slug : undefined;

      // ==========================================
      // LỚP 1: TÌM KIẾM KHẮT KHE (Cùng Loại + Thể loại + Quốc gia)
      // ==========================================
      const strictResponse = await MovieService.getList({
        slug: typeSlug,
        category: primaryGenre,
        country: primaryCountry,
        limit: limit + 5,
      });

      let items = strictResponse.items || [];

      // ==========================================
      // LỚP 2: FALLBACK (Nếu lớp 1 lấy không đủ phim)
      // ==========================================
      if (items.length < limit) {
        const looseResponse = await MovieService.getList({
          slug: typeSlug,
          category: primaryGenre, // Bỏ quốc gia đi, chỉ cần cùng thể loại
          limit: limit + 5,
        });

        // Gộp kết quả lại (Phim xịn đứng trước, phim fallback đứng sau)
        items = [...items, ...(looseResponse.items || [])];
      }

      // ==========================================
      // NHẶT KẸO & LỌC TRÙNG
      // ==========================================
      for (const m of items) {
        if (similarMovies.length >= limit) break;

        const currentEp = (m.episode_current || "").toLowerCase();

        if (
          !currentEp.includes("trailer") &&
          currentEp !== "" &&
          !seenSlugs.has(m.slug)
        ) {
          seenSlugs.add(m.slug);
          similarMovies.push(m);
        }
      }

      if (redis && similarMovies.length > 0) {
        await redis.set(cacheKey, JSON.stringify(similarMovies), {
          ex: 60 * 60 * 24 * 3, // Cache 3 ngày
        });
      }

      return similarMovies;
    } catch (error) {
      console.error(
        `[SIMILAR_MOVIES_ERROR] Lỗi lấy phim tương tự cho ${currentSlug}`,
        error,
      );
      return [];
    }
  },
};
