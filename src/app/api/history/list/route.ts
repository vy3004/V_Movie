import { createSupabaseServer } from "@/lib/supabase/server";
import { redis } from "@/lib/redis";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json([]);

    const listCacheKey = `history_list:${user.id}`;
    const continueWatchingKey = `continue_watching:${user.id}`;

    // Ưu tiên Redis:
    // 1. Lấy danh sách slug theo thứ tự mới nhất từ Sorted Set (score = timestamp)
    // 2. Fallback về cache JSON toàn bộ nếu sorted set chưa có
    // 3. Fallback về Supabase nếu cả hai đều miss
    if (redis) {
      const slugs = await redis.zrange<string[]>(continueWatchingKey, 0, -1, {
        rev: true, // Sắp xếp mới nhất lên đầu (score cao nhất)
      });

      if (slugs && slugs.length > 0) {
        // Lấy chi tiết từng phim qua HGETALL (hoặc từ cache JSON list)
        const cached = await redis.get(listCacheKey);
        if (cached && Array.isArray(cached)) {
          // Sắp xếp lại cache list theo thứ tự sorted set
          const slugOrder = new Map(slugs.map((s, i) => [s, i]));
          const sorted = [...(cached as any[])].sort((a, b) => {
            const ai = slugOrder.get(a.movie_slug) ?? Infinity;
            const bi = slugOrder.get(b.movie_slug) ?? Infinity;
            return ai - bi;
          });
          return NextResponse.json(sorted);
        }
      }

      // Fallback: cache JSON list
      const cached = await redis.get(listCacheKey);
      if (cached) return NextResponse.json(cached);
    }

    const { data, error } = await supabase
      .from("watch_history")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    if (redis && data) await redis.set(listCacheKey, data, { ex: 3600 });

    return NextResponse.json(data || []);
  } catch (error) {
    return NextResponse.json([]);
  }
}