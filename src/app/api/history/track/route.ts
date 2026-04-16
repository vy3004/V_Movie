import { HistoryService } from "@/services/history.service";
import { HistoryUpdatePayload } from "@/types";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const payload: HistoryUpdatePayload = await request.json();

    if (
      !payload.movie_slug ||
      !payload.last_episode_slug ||
      !payload.last_episode_of_movie_slug
    ) {
      return new Response("Missing required fields", { status: 400 });
    }

    if (payload.current_time < 30) {
      return new Response("OK - Too early to track", { status: 200 });
    }

    if (!payload.user_id && !payload.device_id) {
      return new Response("Unauthorized: No user or device ID", {
        status: 401,
      });
    }

    await HistoryService.trackProgress(payload);

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("[HistoryTrack API Error]:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
