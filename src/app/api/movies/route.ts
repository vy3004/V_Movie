import { NextResponse } from "next/server";
import { fetchMoviesWithFallback } from "@/lib/apiClient";
import { redis } from "@/lib/redis";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  // 1. Validation & Parsing
  const rawLimit = searchParams.get("limit");
  const limit = Math.min(Math.max(parseInt(rawLimit || "24", 10), 1), 100); // Giới hạn từ 1-100

  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const cacheKey = `movies_list:${slug}:${limit}`;

  try {
    // 2. KẾ HOẠCH A: Thử lấy từ Redis Cache trước (nếu có)
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return NextResponse.json(cached, {
            headers: { "X-Cache": "HIT-REDIS" },
          });
        }
      } catch (redisError) {
        // Log lỗi Redis nhưng KHÔNG chặn luồng xử lý chính
        console.error("[REDIS_GET_ERROR]:", redisError);
      }
    }

    // 3. KẾ HOẠCH B: Nếu Redis không có hoặc lỗi, gọi API chính để lấy dữ liệu (có fallback)
    const data = await fetchMoviesWithFallback(slug, limit);

    if (!data) {
      return NextResponse.json({ error: "Movies not found" }, { status: 404 });
    }

    // 4. Lưu lại vào Redis (thời gian sống 30 phút)
    if (redis) {
      redis
        .set(cacheKey, data, { ex: 1800 })
        .catch((e) => console.error("[REDIS_SET_ERROR]:", e));
    }

    // 5. Trả về kèm Browser Cache (SWR)
    return NextResponse.json(data, {
      status: 200,
      headers: {
        "X-Cache": "MISS",
        // Browser/CDN cache trong 5p, cho phép dùng data cũ trong 10p khi đang revalidate
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error(`[FETCH_MOVIES_ERROR][SLUG:${slug}]:`, error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
