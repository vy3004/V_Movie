import "server-only";

import { createSupabaseServer } from "@/lib/supabase/server";
import { redis } from "@/lib/redis";
import { NotificationItem } from "@/types";

export const NotificationService = {
  /**
   * 1. Lấy danh sách (Hỗ trợ Infinite Scroll)
   */
  getList: async (userId: string, page: number = 1, limit: number = 15) => {
    page = Math.max(1, Math.floor(page));
    limit = Math.max(1, Math.min(limit, 100));

    const supabase = await createSupabaseServer();
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("[NotificationService.getList]", error);
      return { items: [], nextCursor: null, total: 0 };
    }

    return {
      items: (data as NotificationItem[]) || [],
      nextCursor: count && to < count - 1 ? page + 1 : null,
      total: count || 0,
    };
  },

  /**
   * 2. Đánh dấu đã đọc & Xử lý Cache
   */
  markAsRead: async (userId: string, notiId?: string) => {
    const supabase = await createSupabaseServer();
    let query = supabase.from("notifications").update({ is_read: true });

    if (notiId) {
      query = query.eq("id", notiId).eq("user_id", userId);
    } else {
      query = query.eq("user_id", userId).eq("is_read", false);
    }

    const { data: updatedNotis, error } =
      await query.select("type, movie_slug");
    if (error) throw error;

    // Logic dọn dẹp Cache Redis
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

  /**
   * 3. Xóa thông báo (Dọn dẹp hòm thư)
   */
  clear: async (userId: string, onlyRead: boolean) => {
    const supabase = await createSupabaseServer();
    // Fetch notifications trước khi xóa để dọn cache
    let selectQuery = supabase
      .from("notifications")
      .select("type, movie_slug")
      .eq("user_id", userId);
    if (onlyRead) selectQuery = selectQuery.eq("is_read", true);

    const { data: notisToDelete } = await selectQuery;

    // Thực hiện xóa
    let query = supabase.from("notifications").delete().eq("user_id", userId);

    if (onlyRead) query = query.eq("is_read", true);

    const { error } = await query;
    if (error) throw error;

    if (redis && notisToDelete && notisToDelete.length > 0) {
      const newEpisodeNotis = notisToDelete.filter(
        (n) => n.type === "new_episode" && n.movie_slug,
      );
      if (newEpisodeNotis.length > 0) {
        const pipeline = redis.pipeline();
        newEpisodeNotis.forEach((noti) => {
          pipeline.del(`detail:${noti.movie_slug}`);
        });
        // Cập nhật subscription cache...
        await pipeline.exec();
      }
    }
  },
};
