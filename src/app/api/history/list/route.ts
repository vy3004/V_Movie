import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { redis } from "@/lib/redis";

export async function GET() {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json([], { status: 401 }); // 401 Unauthorized rõ ràng

    const cacheKey = `history_list:${user.id}`;

    // 1. Thử lấy từ Redis
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) return NextResponse.json(cached);
      } catch (redisError) {
        console.warn("[REDIS_READ_ERROR]:", redisError);
        // Không return ở đây, để nó fall-back xuống database bên dưới
      }
    }

    // 2. Lấy từ Database
    const { data, error: dbError } = await supabase
      .from("watch_history")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (dbError) throw dbError;

    // 3. Set Cache thầm lặng
    if (redis && data) {
      redis
        .set(cacheKey, data, { ex: 3600 })
        .catch((e) => console.error("Redis set error", e));
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("[FETCH_LIST_HISTORY_FAILURE]:", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
