import { z } from "zod";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { MovieService } from "@/services/movie.service";
import { redis } from "@/lib/redis";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { MOVIE_IMG_PATH } from "@/lib/configs";
import { MovieRecommendation } from "@/types/movie";
import { CateCtr, UserRecommendation } from "@/types";

export interface AIRecommendation {
  keyword: string;
  reason: string;
}

export interface DBGenreItem {
  name: string;
  value: number;
  color?: string;
}

export interface DBBatchContext {
  user_id: string;
  total_watch_hours: number;
  top_genres: string[];
  recently_finished: string[];
  currently_watching: string[];
}

const GEMINI_MODEL = "gemini-2.5-flash";

// ==========================================
// LUẬT AI DÙNG CHUNG CỦA HỆ THỐNG
// ==========================================
const AI_EXPERT_RULES = `HÃY TUÂN THỦ NGHIÊM NGẶT CÁC QUY TẮC SAU:
1. Thời lượng (total_watch_hours): Nếu < 30h, chọn phim chiếu rạp/phim lẻ. Nếu > 100h, chọn series dài tập để họ "cày".
2. Sự liên kết: Gợi ý phải cùng "vibe" (cảm giác, không khí, thể loại) với "recently_finished" và "currently_watching".
3. KHÔNG TRÙNG LẶP: Tuyệt đối không gợi ý lại phim đã có trong hồ sơ.
4. Nổi tiếng: Chỉ gợi ý phim có thật, nổi tiếng, được đánh giá cao (IMDb > 7.0).

VỀ PHẦN LÝ DO (REASON) - CỰC KỲ QUAN TRỌNG:
5. Văn phong: Xưng "bạn". Phải viết cực kỳ tự nhiên, gợi tò mò, giống như một dòng status review phim ngắn gọn trên mạng xã hội.
6. Điều cấm kỵ: KHÔNG bắt đầu bằng "Bộ phim này...", "Vì bạn đã xem...", "Cốt truyện hấp dẫn...". Đi thẳng vào trọng tâm!
7. Độ dài: KHÔNG VƯỢT QUÁ 25 CHỮ cho mỗi lý do. Chữ nào "đắt" chữ nấy.

VÍ DỤ VỀ CÁCH VIẾT "REASON" TỐT (Hãy học theo phong cách này):
- Nếu họ vừa xem Interstellar: "Đã trót mê vũ trụ của Nolan thì Inception với những tầng giấc mơ hack não là must-watch!"
- Nếu họ thích giật gân: "Cú twist ở 10 phút cuối phim chắc chắn sẽ khiến bạn phải há hốc mồm kinh ngạc."
- Nếu họ thích hài hước: "Chuẩn bị sẵn khăn giấy đi, vì bạn sẽ cười ra nước mắt với độ lầy lội của phim này đấy."
- Nếu họ thích tình cảm: "Một bản tình ca day dứt, đủ để làm trái tim những người chai sạn nhất cũng phải rung động."`;

export const RecommendationService = {
  /**
   * Tính toán thời gian (số giây) từ hiện tại đến 2:00 AM sáng hôm sau.
   */
  getSecondsUntilNext2AM: (): number => {
    const now = new Date();
    const next2AM = new Date();

    next2AM.setHours(2, 0, 0, 0);
    if (now.getTime() > next2AM.getTime()) {
      next2AM.setDate(next2AM.getDate() + 1);
    }
    return Math.floor((next2AM.getTime() - now.getTime()) / 1000);
  },

  /**
   * Kiểm chứng danh sách phim do AI gợi ý với cơ sở dữ liệu thực tế của OPhim.
   */
  validateWithOphim: async (
    aiRecommendations: AIRecommendation[],
    targetLimit: number = 12,
  ): Promise<MovieRecommendation[]> => {
    const validMovies: MovieRecommendation[] = [];
    const chunkSize = 5;

    for (let i = 0; i < aiRecommendations.length; i += chunkSize) {
      if (validMovies.length >= targetLimit) break;

      const chunk = aiRecommendations.slice(i, i + chunkSize);

      const searchPromises = chunk.map(async (item) => {
        try {
          const searchResult = await MovieService.search(item.keyword, 1, 1);

          if (searchResult.items && searchResult.items.length > 0) {
            const firstMovie = searchResult.items[0];
            const currentEp = (firstMovie.episode_current || "").toLowerCase();

            if (currentEp.includes("trailer") || currentEp === "") return null;

            // Lấy danh sách thể loại từ API OPhim (Thường trả về dạng mảng object {name: "Hành Động", ...})
            const extractedCategories = firstMovie.category
              ? firstMovie.category.map((c: CateCtr) => c.name)
              : [];

            return {
              movie_slug: firstMovie.slug,
              name: firstMovie.name,
              thumb_url: `${MOVIE_IMG_PATH}${firstMovie.thumb_url}`,
              episode_current: firstMovie.episode_current,
              reason: item.reason,
              categories: extractedCategories,
            } as MovieRecommendation;
          }
          return null;
        } catch (error) {
          console.error(
            `[OPHIM] Lỗi tìm kiếm MovieService cho: ${item.keyword}`,
            error,
          );
          return null;
        }
      });

      const results = await Promise.all(searchPromises);

      results.forEach((m: MovieRecommendation | null) => {
        if (m !== null && validMovies.length < targetLimit) {
          validMovies.push(m);
        }
      });

      if (
        i + chunkSize < aiRecommendations.length &&
        validMovies.length < targetLimit
      ) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    return validMovies;
  },

  /**
   * Đổ phim do AI tạo ra vào Kho Cache chung (Pool) để cho nhóm người dùng Guest "xài ké".
   * ĐÃ FIX LOGIC: Chỉ lưu phim có chứa thể loại tương ứng vào đúng key của thể loại đó.
   */
  saveToGuestPool: async (movies: MovieRecommendation[], genres: string[]) => {
    const redisClient = redis;

    if (!redisClient || movies.length === 0) return;
    try {
      const ttl = RecommendationService.getSecondsUntilNext2AM();

      // Lưu nguyên mẻ vào pool tổng
      await redisClient.set(`guest_pool:all`, JSON.stringify(movies), {
        ex: ttl,
      });

      // Lọc phim theo từng thể loại rồi mới lưu vào pool riêng
      const genrePromises = genres.map((genre) => {
        const filteredMovies = movies.filter(
          (m) =>
            m.categories &&
            m.categories.some((c) =>
              c.toLowerCase().includes(genre.toLowerCase()),
            ),
        );

        // Chỉ lưu nếu kho thể loại này có phim
        if (filteredMovies.length > 0) {
          return redisClient.set(
            `guest_pool:${genre}`,
            JSON.stringify(filteredMovies),
            { ex: ttl },
          );
        }
        return Promise.resolve(); // Bỏ qua nếu mảng rỗng
      });

      await Promise.all(genrePromises);
    } catch (error) {
      console.error("[GUEST_POOL] Lỗi lưu kho ké:", error);
    }
  },

  // ==========================================
  // CÁC HÀM TRỢ THỦ (INTERNAL HELPERS)
  // ==========================================

  /**
   * [INTERNAL] Nhận kết quả thô từ AI, đi qua màng lọc OPhim và lưu vào DB/Redis
   * ĐÃ FIX LỖI: Bắt exception cho Supabase Upsert
   */
  _processAndSaveResults: async (
    userId: string,
    aiRecommendations: AIRecommendation[],
    topGenres: string[],
  ) => {
    const cleanMovies = await RecommendationService.validateWithOphim(
      aiRecommendations,
      12, // Chốt sổ 12 phim
    );

    if (cleanMovies.length > 0) {
      const { error: upsertError } = await supabaseAdmin
        .from("user_recommendations")
        .upsert({
          user_id: userId,
          recommendations: cleanMovies,
          updated_at: new Date().toISOString(),
        });

      if (upsertError) {
        console.error(`[SUPABASE_UPSERT_ERROR] User: ${userId}`, upsertError);
      }

      if (redis) {
        const ttlTo2AM = RecommendationService.getSecondsUntilNext2AM();
        await redis.set(
          `recommendation:user:${userId}`,
          JSON.stringify(cleanMovies),
          { ex: ttlTo2AM },
        );
      }

      await RecommendationService.saveToGuestPool(cleanMovies, topGenres);
    }
  },

  /**
   * GỌI LẺ (ON-DEMAND): Yêu cầu AI phân tích cho một User duy nhất.
   */
  generateForUser: async (userId: string) => {
    try {
      // Tái sử dụng RPC xịn để lấy data cực nhanh
      const { data: batchContext, error } = await supabaseAdmin.rpc(
        "get_ai_context_batch",
        {
          p_user_ids: [userId],
        },
      );

      if (error || !batchContext || batchContext.length === 0) {
        throw new Error("Không lấy được context từ Database");
      }

      const userContext = batchContext[0];

      const expertPrompt = `Bạn là một "Cinephile" (Người sành phim) đang rủ rê một người bạn xem phim. Nhiệm vụ của bạn là phân tích hồ sơ và đưa ra 15 gợi ý phim xuất sắc nhất.
        Hồ sơ người dùng: 
        ${JSON.stringify(
          {
            userId: userContext.user_id,
            recently_finished: userContext.recently_finished,
            currently_watching: userContext.currently_watching,
            total_watch_hours: userContext.total_watch_hours,
          },
          null,
          2,
        )}
        ${AI_EXPERT_RULES}`;

      const { object: aiResult } = await generateObject({
        model: google(GEMINI_MODEL),
        maxRetries: 3,
        maxOutputTokens: 4096,
        schema: z.object({
          recommendations: z
            .array(
              z.object({
                keyword: z.string(),
                reason: z.string(),
              }),
            )
            .min(12)
            .max(15),
        }),
        prompt: expertPrompt,
      });

      await RecommendationService._processAndSaveResults(
        userId,
        aiResult.recommendations,
        userContext.top_genres,
      );
    } catch (error) {
      console.error(`[RECOMMENDATION_ERROR] User: ${userId}`, error);
    }
  },

  /**
   * GỌI SỈ (BATCHING): Gom nhiều User vào 1 lượt gọi AI duy nhất.
   */
  generateForBatch: async (userIds: string[]) => {
    try {
      const { data, error } = await supabaseAdmin.rpc("get_ai_context_batch", {
        p_user_ids: userIds,
      });

      if (error) throw error;
      if (!data || data.length === 0) return;

      const batchContext = data as DBBatchContext[];

      const aiPayload = batchContext.map((ctx) => ({
        userId: ctx.user_id,
        recently_finished: ctx.recently_finished,
        currently_watching: ctx.currently_watching,
        total_watch_hours: ctx.total_watch_hours,
      }));

      const expertPrompt = `Bạn là một "Cinephile" (Người sành phim). 
      Tôi đang gửi cho bạn danh sách hồ sơ của ${userIds.length} người dùng khác nhau.
      
      HỒ SƠ NGƯỜI DÙNG: 
      ${JSON.stringify(aiPayload, null, 2)}
      
      BẮT BUỘC TRẢ VỀ ĐỦ KẾT QUẢ CHO TỪNG 'userId' TRONG DANH SÁCH TRÊN.
      Với mỗi người, gợi ý từ 12 đến 15 phim xuất sắc nhất.
      ${AI_EXPERT_RULES}`;

      const { object: aiResult } = await generateObject({
        model: google(GEMINI_MODEL),
        maxRetries: 3,
        maxOutputTokens: 8192,
        schema: z.object({
          batch_results: z.array(
            z.object({
              userId: z.string(),
              recommendations: z
                .array(
                  z.object({
                    keyword: z.string(),
                    reason: z.string(),
                  }),
                )
                .min(12)
                .max(15),
            }),
          ),
        }),
        prompt: expertPrompt,
      });

      const processPromises = aiResult.batch_results.map((result) => {
        const originData = batchContext.find(
          (u) => String(u.user_id) === String(result.userId),
        );
        if (originData) {
          return RecommendationService._processAndSaveResults(
            result.userId,
            result.recommendations,
            originData.top_genres,
          );
        }
      });

      await Promise.all(processPromises);
    } catch (error) {
      console.error(`[RECOMMENDATION_BATCH_ERROR]`, error);
    }
  },

  /**
   * XỬ LÝ KHÁCH (GUEST): Lấy phim gợi ý siêu tốc (Real-time) cho người dùng vãng lai chưa đăng nhập.
   */
  getForGuest: async (
    localProfile: UserRecommendation,
  ): Promise<MovieRecommendation[]> => {
    const targetTotal = 12;
    const genreCounts = localProfile.genre_counts || {};
    const genres = Object.keys(genreCounts);

    if (genres.length === 0) return [];

    const topGenres = [...genres]
      .sort((a, b) => genreCounts[b] - genreCounts[a])
      .slice(0, 3);

    // ==========================================
    // ƯU TIÊN 1: LẤY KÉ TỪ POOL CỦA AI
    // ==========================================
    if (redis && topGenres.length > 0) {
      for (const genre of topGenres) {
        const cached = await redis.get(`guest_pool:${genre}`);
        if (cached) {
          const parsed =
            typeof cached === "string" ? JSON.parse(cached) : cached;
          if (parsed && parsed.length >= targetTotal) {
            return parsed
              .slice(0, targetTotal)
              .map((m: MovieRecommendation) => ({
                ...m,
                movie_slug: m.movie_slug,
              }));
          }
        }
      }

      const generalCached = await redis.get(`guest_pool:all`);
      if (generalCached) {
        const parsed =
          typeof generalCached === "string"
            ? JSON.parse(generalCached)
            : generalCached;
        if (parsed && parsed.length >= targetTotal) {
          return parsed.slice(0, targetTotal).map((m: MovieRecommendation) => ({
            ...m,
            movie_slug: m.movie_slug,
          }));
        }
      }
    }

    // ==========================================
    // ƯU TIÊN 2: FALLBACK - TRỘN THEO TỈ LỆ
    // ==========================================
    try {
      const fallbackMovies: MovieRecommendation[] = [];
      const totalWatched = Object.values(genreCounts).reduce(
        (a, b) => a + b,
        0,
      );
      const allocations: Record<string, number> = {};
      let allocatedCount = 0;

      for (const genre of genres) {
        const quota = Math.floor(
          (genreCounts[genre] / totalWatched) * targetTotal,
        );
        allocations[genre] = quota;
        allocatedCount += quota;
      }

      let remainder = targetTotal - allocatedCount;
      const sortedGenres = [...genres].sort(
        (a, b) => genreCounts[b] - genreCounts[a],
      );
      let i = 0;
      while (remainder > 0 && genres.length > 0) {
        allocations[sortedGenres[i % sortedGenres.length]]++;
        remainder--;
        i++;
      }

      const fetchPromises = Object.entries(allocations).map(
        async ([genreSlug, quota]) => {
          if (quota === 0) return { genreSlug, quota, items: [] };

          const data = await MovieService.getByGenre(genreSlug, 1, quota + 5);
          return { genreSlug, quota, items: data?.items || [] };
        },
      );

      const results = await Promise.all(fetchPromises);
      const seenSlugs = new Set<string>();

      results.forEach(({ quota, items }) => {
        let addedForThisGenre = 0;

        for (const m of items) {
          if (addedForThisGenre >= quota) break;

          const currentEp = (m.episode_current || "").toLowerCase();

          if (
            !currentEp.includes("trailer") &&
            currentEp !== "" &&
            !seenSlugs.has(m.slug)
          ) {
            seenSlugs.add(m.slug);
            fallbackMovies.push({
              movie_slug: m.slug,
              name: m.name,
              thumb_url: `${MOVIE_IMG_PATH}${m.thumb_url}`,
              episode_current: m.episode_current || "Tập mới",
              reason: "",
            });
            addedForThisGenre++;
          }
        }
      });

      if (fallbackMovies.length < targetTotal) {
        for (const { items } of results) {
          for (const m of items) {
            if (fallbackMovies.length >= targetTotal) break;

            const currentEp = (m.episode_current || "").toLowerCase();
            if (
              !currentEp.includes("trailer") &&
              currentEp !== "" &&
              !seenSlugs.has(m.slug)
            ) {
              seenSlugs.add(m.slug);
              fallbackMovies.push({
                movie_slug: m.slug,
                name: m.name,
                thumb_url: `${MOVIE_IMG_PATH}${m.thumb_url}`,
                episode_current: m.episode_current || "Tập mới",
                reason: "",
              });
            }
          }
        }
      }

      return fallbackMovies.slice(0, targetTotal);
    } catch (error) {
      console.error("[GUEST_FALLBACK_ERROR]", error);
      return [];
    }
  },
};
