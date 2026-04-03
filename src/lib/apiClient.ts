import axios from "axios";
import { apiConfig, WEB_TITLE } from "@/lib/configs";
import {
  PageMovieData,
  PageMoviesData,
  CateCtr,
  HistoryItem,
} from "@/lib/types";
import { redis } from "@/lib/redis";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Hàm tạo Cache Key duy nhất dựa trên params (Base64)
 */
const getCacheKey = (prefix: string, params: object = {}) => {
  const queryStr = Buffer.from(JSON.stringify(params)).toString("base64");
  return `${prefix}:${queryStr}`;
};

/**
 * 1. Fetch danh sách phim (CÓ REDIS CACHE - 2 Giờ)
 */
export const fetchMovies = async (
  slug: string,
  searchParams: Record<string, string | undefined> = {},
): Promise<PageMoviesData> => {
  const cacheKey = getCacheKey(`movies:${slug}`, searchParams);

  try {
    // Thử lấy từ Redis trước
    if (redis) {
      const cached = await redis.get<PageMoviesData>(cacheKey);
      if (cached) {
        console.log(`🚀 [Redis Hit] List: ${slug}`);
        return cached;
      }
    }

    const filteredParams = Object.entries(searchParams)
      .filter(([, value]) => value !== undefined)
      .reduce(
        (acc, [key, value]) => {
          if (value) acc[key] = value;
          return acc;
        },
        {} as Record<string, string>,
      );

    const queryParams = new URLSearchParams(filteredParams);
    const baseUrl =
      slug === "tim-kiem" ? apiConfig.SEARCH_URL : apiConfig.MOVIES_URL;
    const url = `${baseUrl}${slug}?${queryParams.toString()}`;

    const { data } = await axios.get(url);

    const result: PageMoviesData = {
      ...data.data,
      seoOnPage: {
        ...data.data.seoOnPage,
        titleHead: `${WEB_TITLE} | ${data.data.seoOnPage.titleHead}`,
      },
      titlePage: `${WEB_TITLE} | ${data.data.titlePage}`,
    };

    // Lưu vào Redis nếu có dữ liệu
    if (redis && result.items?.length > 0) {
      await redis.set(cacheKey, result, { ex: 7200 });
    }

    return result;
  } catch (error) {
    console.error("❌ Error fetching movies:", error);
    return getMoviesFallback(slug);
  }
};

/**
 * 2. Fetch phim trang chủ (Kết hợp năm hiện tại + năm trước)
 */
export const fetchMoviesWithFallback = async (
  type: string,
  limit: number,
): Promise<PageMoviesData> => {
  const currentYear = new Date().getFullYear().toString();
  const previousYear = (new Date().getFullYear() - 1).toString();

  const currentYearMovies = await fetchMovies(type, {
    sort_field: "tmdb.vote_count",
    year: currentYear,
  });

  if (currentYearMovies.items.length >= limit) {
    return {
      ...currentYearMovies,
      items: currentYearMovies.items.slice(0, limit),
    };
  }

  const previousYearMovies = await fetchMovies(type, {
    sort_field: "tmdb.vote_count",
    year: previousYear,
  });

  return {
    ...currentYearMovies,
    items: [
      ...currentYearMovies.items,
      ...previousYearMovies.items.slice(
        0,
        limit - currentYearMovies.items.length,
      ),
    ],
  };
};

/**
 * 3. Fetch chi tiết phim (CÓ REDIS CACHE - 24 Giờ)
 */
export const fetchDetailMovie = async ({
  slug,
}: {
  slug: string;
}): Promise<PageMovieData> => {
  const cacheKey = `detail:${slug}`;

  try {
    if (redis) {
      const cached = await redis.get<PageMovieData>(cacheKey);
      if (cached) {
        console.log(`🚀 [Redis Hit] Detail: ${slug}`);
        return cached;
      }
    }

    const { data } = await axios.get(`${apiConfig.MOVIE_URL}${slug}`);

    const result: PageMovieData = {
      ...data.data,
      seoOnPage: {
        ...data.data.seoOnPage,
        titleHead: `${WEB_TITLE} | ${data.data.seoOnPage.titleHead}`,
      },
    };

    if (redis && result.item) {
      await redis.set(cacheKey, result, { ex: 86400 });
    }
    console.log(`✅ [API Fetch] Detail: ${result}`);
    return result;
  } catch (error) {
    console.error("❌ Error fetching detail movie:", error);
    return {
      seoOnPage: {
        titleHead: WEB_TITLE,
        descriptionHead: "",
        og_image: [],
        og_url: "",
        og_type: "video.movie",
      },
      breadCrumb: [],
      params: { slug },
      item: null,
    };
  }
};

/**
 * 4. Fetch Metadata (Thể loại & Quốc gia - CÓ CACHE VV)
 */
export const fetchCategories = async (): Promise<CateCtr[]> => {
  const cacheKey = "metadata:categories";
  try {
    if (redis) {
      const cached = await redis.get<CateCtr[]>(cacheKey);
      if (cached) return cached;
    }
    const response = await axios.get(apiConfig.CATEGORIES_URL);
    const data = response.data.data.items;
    if (redis) await redis.set(cacheKey, data);
    return data;
  } catch {
    return [];
  }
};

export const fetchCountries = async (): Promise<CateCtr[]> => {
  const cacheKey = "metadata:countries";
  try {
    if (redis) {
      const cached = await redis.get<CateCtr[]>(cacheKey);
      if (cached) return cached;
    }
    const response = await axios.get(apiConfig.COUNTRIES_URL);
    const data = response.data.data.items;
    if (redis) await redis.set(cacheKey, data, { ex: 604800 });
    return data;
  } catch {
    return [];
  }
};

/**
 * 5. Lấy lịch sử xem phim (Redis -> Supabase -> Backfill)
 */
export const getLatestHistory = async (
  userId: string,
  movieSlug: string,
): Promise<HistoryItem | null> => {
  // Định nghĩa kiểu trả về rõ ràng
  const cacheKey = `user_history:${userId}:${movieSlug}`;

  try {
    // BƯỚC 1: Check Redis (Nhanh nhất)
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        console.log(`✅ [History Hit] Redis: ${movieSlug}`);

        const parsedData =
          typeof cached === "string"
            ? (JSON.parse(cached) as HistoryItem)
            : (cached as HistoryItem);

        return parsedData;
      }
    }

    // BƯỚC 2: Check Supabase
    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from("watch_history")
      .select("*")
      .eq("user_id", userId)
      .eq("movie_slug", movieSlug)
      .maybeSingle<HistoryItem>();

    if (error) {
      console.error("❌ Supabase History Error:", error.message);
      return null;
    }

    // Nếu có dữ liệu từ DB nhưng Redis chưa có, ta thực hiện "Backfill" (Ghi ngược lại Cache)
    if (data && redis) {
      await redis.set(cacheKey, JSON.stringify(data), { ex: 86400 }); // Cache 1 ngày
    }

    return data;
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Lỗi không xác định";
    console.error(
      `❌ Global History Fetch Error [${movieSlug}]:`,
      errorMessage,
    );
    return null;
  }
};

/**
 * Helper: Trả về dữ liệu mặc định khi lỗi (Khớp interface PageMoviesData)
 */
const getMoviesFallback = (slug: string): PageMoviesData => ({
  seoOnPage: {
    titleHead: WEB_TITLE,
    descriptionHead: "",
    og_image: [],
    og_url: "",
    og_type: "website",
  },
  breadCrumb: [],
  titlePage: WEB_TITLE,
  items: [],
  params: {
    type_slug: slug,
    filterCategory: [],
    filterCountry: [],
    filterYear: "",
    filterType: "",
    sortField: "",
    sortType: "",
    pagination: {
      totalItems: 0,
      totalItemsPerPage: 0,
      currentPage: 0,
      pageRanges: 0,
    },
  },
});
