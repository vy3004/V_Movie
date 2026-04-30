import { NextResponse } from "next/server";
import { RecommendationService } from "@/services/recommendation.service";
import { UserRecommendation } from "@/types";

export const maxDuration = 30; // Nới lỏng thời gian chạy trên Vercel cho an toàn

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const genre_counts = body.genre_counts || {};

    // Nếu không có bất kỳ thể loại nào được gửi lên -> Thoát luôn, trả về mảng rỗng
    if (Object.keys(genre_counts).length === 0) {
      return NextResponse.json({ success: true, movies: [] });
    }

    const guestProfile: UserRecommendation = {
      genre_counts: genre_counts,
      recently_finished: body.recently_finished || [],
      currently_watching: body.currently_watching || [],
    };

    const movies = await RecommendationService.getForGuest(guestProfile);

    return NextResponse.json({ success: true, movies });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[API_GUEST_RECOMMEND_ERROR]", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
