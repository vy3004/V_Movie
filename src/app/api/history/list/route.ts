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

    const cacheKey = `history_list:${user.id}`;

    // Ưu tiên Redis
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) return NextResponse.json(cached);
    }

    const { data, error } = await supabase
      .from("watch_history")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }); // SORT MỚI NHẤT LÊN ĐẦU

    if (error) throw error;

    if (redis && data) await redis.set(cacheKey, data, { ex: 3600 });

    return NextResponse.json(data || []);
  } catch (error) {
    return NextResponse.json([]);
  }
}
