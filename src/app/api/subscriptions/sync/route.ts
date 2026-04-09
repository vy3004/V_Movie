import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { SubscriptionItem } from "@/lib/types";
import { redis } from "@/lib/redis";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const localSubs: SubscriptionItem[] = body.localSubscriptions;

    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !localSubs || localSubs.length === 0)
      return NextResponse.json({ success: true });

    // BƯỚC 1: Lấy danh sách phim user ĐÃ theo dõi trong DB để so sánh
    const { data: existingDBSubs, error: selectError } = await supabase
      .from("user_subscriptions")
      .select("movie_slug, has_new_episode, last_known_episode_slug")
      .eq("user_id", user.id);

    if (selectError) throw selectError;

    const dbMap = new Map(existingDBSubs?.map((s) => [s.movie_slug, s]));

    // BƯỚC 2: Merge thông minh
    const upsertData = localSubs.map((localItem) => {
      const dbItem = dbMap.get(localItem.movie_slug);

      return {
        user_id: user.id,
        movie_slug: localItem.movie_slug,
        movie_name: localItem.movie_name,
        movie_poster: localItem.movie_poster,
        // Ưu tiên giữ lại slug tập mới nhất
        last_known_episode_slug:
          localItem.last_known_episode_slug || dbItem?.last_known_episode_slug,
        // QUAN TRỌNG: Nếu DB đang báo có tập mới (true), thì giữ nguyên true
        has_new_episode:
          dbItem?.has_new_episode || localItem.has_new_episode || false,
        updated_at: new Date().toISOString(),
      };
    });

    // BƯỚC 3: Upsert
    const { error } = await supabase
      .from("user_subscriptions")
      .upsert(upsertData, { onConflict: "user_id,movie_slug" });

    if (error) throw error;

    if (redis) await redis.del(`subscriptions:user:${user.id}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sync Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
