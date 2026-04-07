import { updateHistoryCache } from "@/lib/utils";
import { HistoryUpdatePayload } from "@/lib/types";

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    // 1. Nhận payload từ frontend gửi qua sendBeacon
    const payload: HistoryUpdatePayload = await request.json();

    // 2. Validate cơ bản: Chỉ xử lý nếu có đủ dữ liệu cần thiết
    if (!payload.movie_slug || !payload.last_episode_slug || !payload.last_episode_of_movie_slug) {
      return new Response('Missing required fields', { status: 400 });
    }

    // 3. Nghiệp vụ: Nếu current_time < 30 giây -> Bỏ qua để tránh spam DB/Cache
    if (payload.current_time < 30) {
      return new Response('OK - Too early to track', { status: 200 });
    }

    // 4. Trích xuất thông tin định danh
    const userId = payload.user_id;
    const deviceId = payload.device_id;

    // Nếu không có user_id và cũng không có device_id thì không thể lưu
    if (!userId && !deviceId) {
      return new Response('Unauthorized: No user or device ID', { status: 401 });
    }

    // 5. Update thẳng vào Redis qua hàm updateHistoryCache.
    await updateHistoryCache(userId, deviceId, payload);

    // 6. Trả về 200 OK ngay lập tức
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error("[HistoryTrack API Error]:", error);
    return new Response('Internal Server Error', { status: 500 });
  }
}