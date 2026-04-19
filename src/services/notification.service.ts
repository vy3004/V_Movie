import "server-only";
import { createSupabaseServer } from "@/lib/supabase/server";
import { redis } from "@/lib/redis";
import { NotificationItem } from "@/types";

export const NotificationService = {
  /**
   * Lấy danh sách thông báo
   */
  getList: async (
    userId: string,
    limit: number = 20,
  ): Promise<NotificationItem[]> => {
    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[NotificationService.getList]", error);
      return [];
    }

    return data as NotificationItem[];
  },

  /**
   * Đánh dấu đã đọc & XÓA CACHE TẬP MỚI
   */
  markAsRead: async (userId: string, notiId?: string) => {
    const supabase = await createSupabaseServer();

    // 1. Cập nhật DB
    let query = supabase.from("notifications").update({ is_read: true });

    if (notiId) {
      query = query.eq("id", notiId).eq("user_id", userId);
    } else {
      query = query.eq("user_id", userId).eq("is_read", false);
    }

    // Quan trọng: Trả về data sau khi update để biết thông báo đó nói về phim nào
    const { data: updatedNotis, error } =
      await query.select("type, movie_slug");
    if (error) throw error;

    // 2. Logic Cache Invalidation
    if (redis && updatedNotis && updatedNotis.length > 0) {
      // Tìm xem trong số các thông báo vừa đọc, có cái nào là "có tập mới" không
      const newEpisodeNotis = updatedNotis.filter(
        (n) => n.type === "new_episode" && n.movie_slug,
      );

      if (newEpisodeNotis.length > 0) {
        const pipeline = redis.pipeline();

        // Xóa cache chi tiết của từng bộ phim để buộc hệ thống fetch lại từ OPhim
        newEpisodeNotis.forEach((noti) => {
          pipeline.del(`detail:${noti.movie_slug}`);
        });

        // Đồng thời cập nhật trạng thái "has_new_episode = false" trong Subscription Cache
        // Tránh phải gọi lại hàm clearBadge bên SubscriptionService
        const subKey = `subs:user:${userId}`;
        const subsHash = await redis.hgetall(subKey);

        if (subsHash) {
          newEpisodeNotis.forEach((noti) => {
            const slug = noti.movie_slug!;
            const subStr = subsHash[slug];
            if (subStr) {
              const subObj =
                typeof subStr === "string" ? JSON.parse(subStr) : subStr;
              subObj.has_new_episode = false;
              pipeline.hset(subKey, { [slug]: JSON.stringify(subObj) });
            }
          });
        }

        await pipeline.exec();
      }
    }
  },
};
