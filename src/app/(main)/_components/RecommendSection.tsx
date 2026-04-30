import RecommendSlider from "./RecommendSlider";
import { createSupabaseServer } from "@/lib/supabase/server";
import { redis } from "@/lib/redis";
import { MovieRecommendation } from "@/types/movie";

export default async function RecommendSection() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let aiMovies: MovieRecommendation[] = [];

  if (user) {
    try {
      if (redis) {
        const cached = await redis.get(`recommendation:user:${user.id}`);
        if (cached) {
          aiMovies = typeof cached === "string" ? JSON.parse(cached) : cached;
        }
      }

      if (!aiMovies || aiMovies.length === 0) {
        const { data } = await supabase
          .from("user_recommendations")
          .select("recommendations")
          .eq("user_id", user.id)
          .maybeSingle();

        if (data && Array.isArray(data.recommendations)) {
          aiMovies = data.recommendations;
        }
      }
    } catch (error) {
      console.error("[RecommendSection] Lỗi lấy data AI:", error);
    }
  }

  return <RecommendSlider initialMovies={aiMovies} isGuest={!user} />;
}
