import { NextResponse } from "next/server";
import { fetchMovies } from "@/lib/apiClient";
import { typesMovie } from "@/lib/configs";
import { redis } from "@/lib/redis";

export async function GET() {
  const cacheKey = "top_movies_list";
  const CACHE_TTL = 3600; // Cache 1h

  try {
    // 1. KẾ HOẠCH A: Thử lấy từ Redis
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return NextResponse.json(cached, {
            headers: { "X-Cache": "HIT-REDIS" },
          });
        }
      } catch (redisError) {
        console.error("[REDIS_TOP_MOVIES_ERROR]:", redisError);
      }
    }

    // 2. KẾ HOẠCH B: Fetch thực tế từ API chính (có fallback)
    const data = await fetchMovies(typesMovie.NEW.slug, {
      sort_field: "tmdb.vote_count",
    });

    const topMovies = data?.items || [];

    if (topMovies.length === 0) {
      return NextResponse.json({ error: "No movies found" }, { status: 404 });
    }

    // 3. Lưu vào Redis để phục vụ các request sau
    if (redis && topMovies.length > 0) {
      redis
        .set(cacheKey, topMovies, { ex: CACHE_TTL })
        .catch((e) => console.error("[REDIS_SET_TOP_MOVIES_ERROR]:", e));
    }

    // 4. Trả về kèm Header Cache cho trình duyệt và CDN (Vercel Edge)
    return NextResponse.json(topMovies, {
      status: 200,
      headers: {
        "X-Cache": "MISS",
        // Cache trên trình duyệt 10p, trên CDN 1 tiếng, trả về data cũ nếu đang cập nhật
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("[FETCH_TOP_MOVIES_FAILURE]:", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
