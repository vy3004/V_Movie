import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { localHistory } = await req.json();
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !localHistory.length) return NextResponse.json({ skip: true });

  // Chuẩn bị dữ liệu để đẩy vào Supabase
  const syncData = localHistory.map((item: any) => ({
    user_id: user.id,
    movie_slug: item.movieSlug,
    movie_name: item.movieName,
    movie_poster: item.moviePoster,
    last_time: item.lastTime,
    duration: item.duration,
    last_episode_slug: item.episodeSlug,
    updated_at: item.updated_at,
  }));

  // Upsert hàng loạt (Bulk Upsert)
  await supabase
    .from("watch_history")
    .upsert(syncData, { onConflict: "user_id, movie_slug" });

  return NextResponse.json({ success: true });
}
