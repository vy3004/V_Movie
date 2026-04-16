import "server-only";
import axios from "axios";
import { redis } from "@/lib/redis";
import { BASE_MOVIE_API, WEB_TITLE } from "@/lib/configs";
import { PageMovieData, PageMoviesData, MovieQueryParams } from "@/types";

/**
 * Hàm tạo Cache Key duy nhất (Sắp xếp keys để tránh trùng lặp)
 */
const getCacheKey = (prefix: string, params: object = {}) => {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((obj: any, key: string) => {
      obj[key] = (params as any)[key];
      return obj;
    }, {});
  const queryStr = Buffer.from(JSON.stringify(sortedParams)).toString("base64");
  return `${prefix}:${queryStr}`;
};

export const MovieService = {
  /**
   * 1. Lấy chi tiết phim (Cache 24h)
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
          titleHead: `${WEB_TITLE} | ${data.data.seoOnPage.titleHead}`,
        },
      };

      if (redis && result.item) {
        // Nếu phim đang chiếu (ongoing), chỉ cache 15 phút (600s)
        // Nếu phim đã xong (completed), cache 24 tiếng (86400s)
        const isOngoing = result.item.status === "ongoing";
        const ttl = isOngoing ? 600 : 86400;

        await redis.set(cacheKey, result, { ex: ttl });
      }
      return result;
    } catch (error) {
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

    const cacheKey = getCacheKey(`movies:${slug}`, params);
    if (redis) {
      const cached = await redis.get<PageMoviesData>(cacheKey);
      if (cached) return cached;
    }

    const currentYear = new Date().getFullYear().toString();
    const previousYear = (new Date().getFullYear() - 1).toString();

    try {
      // Logic: Gọi API v1 (để hỗ trợ lọc category/country/year tốt hơn)
      const fetchFromApi = async (yearValue?: string) => {
        const apiParams = {
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
      let apiData = await fetchFromApi(filters.year ? undefined : currentYear);

      // BƯỚC 2: Logic Fallback (Vét phim năm trước nếu không đủ số lượng limit)
      // Chỉ áp dụng khi slug là phim-bo/phim-le và user không yêu cầu năm cụ thể
      const isListType = ["phim-bo", "phim-le", "hoathinh"].includes(slug);
      if (isListType && !filters.year && apiData.items.length < limit) {
        const prevData = await fetchFromApi(previousYear);
        const needed = Number(limit) - apiData.items.length;
        apiData.items = [...apiData.items, ...prevData.items.slice(0, needed)];
      }

      const result: PageMoviesData = {
        items: apiData.items,
        params: apiData.params,
        titlePage: apiData.titlePage,
        breadCrumb: apiData.breadCrumb,
        seoOnPage: {
          ...apiData.seoOnPage,
          titleHead: `${WEB_TITLE} | ${apiData.seoOnPage.titleHead}`,
        },
      };

      if (redis && result.items.length > 0) {
        await redis.set(cacheKey, result, { ex: 7200 });
      }

      return result;
    } catch (error) {
      console.error("MovieService.getList error:", error);
      throw error;
    }
  },

  search: async (
    keyword: string,
    page: number = 1,
    limit: number = 24,
  ): Promise<PageMoviesData> => {
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

      // MAPPING AN TOÀN: Tuyệt đối không để crash nếu thiếu field
      const result: PageMoviesData = {
        items: apiData.items || [],
        params: apiData.params || {
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
        await redis.set(cacheKey, result, { ex: 3600 }); // Cache search 1h
      }
      return result;
    } catch (error) {
      console.error("MovieService.search Error:", error);
      throw error;
    }
  },

  /**
   * 3. Lấy Metadata (Thể loại & Quốc gia - Cache 30 ngày)
   */
  getMetadata: async () => {
    const cacheKey = "metadata:all";
    const THIRTY_DAYS = 2592000; // 30 * 24 * 60 * 60

    if (redis) {
      const cached = await redis.get<any>(cacheKey);
      if (cached) return { data: cached, source: "HIT-REDIS" };
    }

    try {
      const [catsRes, countriesRes] = await Promise.all([
        axios.get(`${BASE_MOVIE_API}/the-loai`),
        axios.get(`${BASE_MOVIE_API}/quoc-gia`),
      ]);

      const metadata = {
        categories: catsRes.data.items || [],
        countries: countriesRes.data.items || [],
      };

      if (redis && metadata.categories.length > 0) {
        await redis.set(cacheKey, metadata, { ex: THIRTY_DAYS });
      }

      return { data: metadata, source: "MISS" };
    } catch (error) {
      return { data: { categories: [], countries: [] }, source: "ERROR" };
    }
  },
};
