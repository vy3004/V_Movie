import { HistoryService } from "@/services/history.service";
import { historyTrackSchema } from "@/lib/validations/history.validation";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const result = historyTrackSchema.safeParse(body);

    if (!result.success) {
      const firstError = result.error.issues[0];
      console.warn("[HistoryTrack] Validation failed:", {
        field: firstError.path.join("."),
        message: firstError.message,
      });
      return new Response(
        JSON.stringify({
          error: "Invalid input",
          details: firstError.message,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const payload = result.data;

    // Skip tracking nếu thời gian quá ngắn
    if (payload.current_time < 30) {
      return new Response("OK - Too early to track", { status: 200 });
    }

    await HistoryService.trackProgress(payload);

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("[HistoryTrack API Error]:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
