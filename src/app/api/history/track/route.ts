import { updateHistoryCache } from "@/lib/utils";

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    // Validate Payload. Nếu current_time < 30 giây -> Bỏ qua (không lưu).
    if (payload.current_time < 30) {
      return new Response('OK');
    }

    // Check is_finished = (current_time / duration) > 0.9.
    const is_finished = (payload.current_time / payload.duration) > 0.9;

    // Read user_id and device_id from payload (not headers, since sendBeacon doesn't support custom headers)
    const userId = payload.user_id || undefined;
    const deviceId = payload.device_id || undefined;

    // Update thẳng vào Redis Hash qua hàm updateHistoryCache.
    await updateHistoryCache(userId, deviceId, payload);

    // Trả về 200 OK ngay lập tức (Không gọi Supabase ở đây).
    return new Response('OK');
  } catch (error) {
    console.error(error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
