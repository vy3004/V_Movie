import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { redis } from "@/lib/redis";
import { HistoryItem } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const historyItem: HistoryItem = await req.json();

    // Basic validation
    if (!historyItem?.movie_slug || !historyItem?.last_episode_slug) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // UPSERT 
    const { error } = await supabase.from("watch_history").upsert(
      {
        user_id: user.id,
        ...historyItem,
      },
      { onConflict: "user_id, movie_slug" },
    );

    if (error) throw error;

    try {
      if (redis) await redis.del(`history_list:${user.id}`);
    } catch (redisErr) {
      console.warn("[REDIS_WARN] Could not clear history cache:", redisErr);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API_HISTORY_POST_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
