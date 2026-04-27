import "server-only";

import { createSupabaseServer } from "@/lib/supabase/server";
import { redis } from "@/lib/redis";
import { DashboardStats } from "@/types";

/**
 * Dữ liệu mặc định trả về để đảm bảo UI không bị crash
 * khi User mới chưa có lịch sử hoặc khi Database gặp sự cố.
 */
const DEFAULT_STATS: DashboardStats = {
  totalHours: 0,
  streakDays: 0,
  growthPercentage: 0,
  genreData: [],
  activityData: [],
};

export const DashboardService = {
  /**
   * Lấy thống kê Dashboard của User.
   * Logic: Kiểm tra Redis -> Nếu không có thì gọi SQL RPC -> Lưu lại Redis -> Trả về.
   */
  getStats: async (userId: string): Promise<DashboardStats> => {
    if (!userId) return DEFAULT_STATS;

    const CACHE_KEY = `user:${userId}:dashboard:stats`;
    const CACHE_TTL = 900; // Cache 15 phút

    try {
      // --- BƯỚC 1: KIỂM TRA BỘ NHỚ ĐỆM (REDIS) ---
      if (redis) {
        const cachedData = await redis.get(CACHE_KEY);
        if (cachedData) {
          try {
            // Trả về ngay nếu có cache, giúp trang load trong ~20ms
            return (
              typeof cachedData === "string"
                ? JSON.parse(cachedData)
                : cachedData
            ) as DashboardStats;
          } catch (parseError) {
            console.warn(
              `[CACHE_PARSE_ERROR] Dọn dẹp cache lỗi tại ${CACHE_KEY}, error: ${parseError}`,
            );
            redis.del(CACHE_KEY).catch(() => {});
          }
        }
      }

      // --- BƯỚC 2: GỌI TRỰC TIẾP SQL RPC (Dữ liệu đã được SQL tính toán sẵn) ---
      const supabase = await createSupabaseServer();
      const { data, error } = await supabase.rpc("get_dashboard_stats", {
        p_user_id: userId,
      });

      if (error) {
        console.error("[DB_RPC_ERROR] get_dashboard_stats:", error);
        return DEFAULT_STATS;
      }

      /**
       * Dữ liệu trả về từ SQL RPC hiện đã bao gồm:
       * - growthPercentage thực tế (so sánh tuần này/tuần trước)
       * - genreData đã gom nhóm thành 1 mục "Khác" duy nhất
       * - genreData đã có sẵn mã màu 'color' rực rỡ gán theo thứ hạng
       */
      const result: DashboardStats = {
        totalHours: data?.totalHours || 0,
        streakDays: data?.streakDays || 0,
        growthPercentage: data?.growthPercentage || 0,
        genreData: data?.genreData || [],
        activityData: data?.activityData || [],
      };

      // --- BƯỚC 3: CẬP NHẬT CACHE (CHẠY NGẦM) ---
      if (redis && (result.totalHours > 0 || result.genreData.length > 0)) {
        redis
          .set(CACHE_KEY, JSON.stringify(result), { ex: CACHE_TTL })
          .catch((e) => console.error("[REDIS_SET_ERROR]:", e));
      }

      return result;
    } catch (error) {
      console.error("[DASHBOARD_SERVICE_ERROR]:", error);
      return DEFAULT_STATS;
    }
  },

  /**
   * Xóa bỏ bộ nhớ đệm Dashboard.
   * Cần gọi hàm này bất cứ khi nào User cập nhật lịch sử xem phim
   */
  invalidateStatsCache: async (userId: string) => {
    if (!redis || !userId) return;
    try {
      const CACHE_KEY = `user:${userId}:dashboard:stats`;
      await redis.del(CACHE_KEY);
    } catch (error) {
      console.error("[INVALIDATE_STATS_CACHE_ERROR]:", error);
    }
  },
};
