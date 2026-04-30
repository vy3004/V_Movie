import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { RecommendationService } from "@/services/recommendation.service";

export const maxDuration = 60;

// Hàm ép hệ thống tạm nghỉ
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface RequestBody {
  totalProcessed?: number;
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Xác thực bảo mật chặn người lạ gọi API
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const totalProcessed = body.totalProcessed || 0;

    const BATCH_SIZE = 4;
    // Đặt giới hạn an toàn để không "đốt" sạch tiền API Gemini trong 1 đêm
    const MAX_USERS_PER_RUN = 400;

    // ==========================================
    // 1. TÌM USER CẦN CHẠY
    // Ưu tiên người chưa từng được gợi ý (null) hoặc người có gợi ý cũ nhất
    // ==========================================
    const twentyFourHoursAgo = new Date(
      Date.now() - 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: usersToProcess, error: userError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .or(
        `last_ai_recommendation_at.is.null,last_ai_recommendation_at.lt.${twentyFourHoursAgo}`,
      )
      .order("last_ai_recommendation_at", { ascending: true, nullsFirst: true })
      .limit(BATCH_SIZE);

    if (userError) throw userError;

    if (!usersToProcess || usersToProcess.length === 0) {
      return NextResponse.json({
        message: "Không tìm thấy User nào để cập nhật.",
      });
    }

    const currentBatchUserIds = usersToProcess.map((u) => String(u.id));

    // ==========================================
    // 2. CLAIM USERS (Khóa dữ liệu chống Race Condition)
    // Cập nhật timestamp NGAY LẬP TỨC để các Cron khác không bốc trúng 4 ông này nữa
    // ==========================================
    const processingTimestamp = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ last_ai_recommendation_at: processingTimestamp })
      .in("id", currentBatchUserIds);

    if (updateError) {
      throw new Error(
        `Failed to update user timestamps: ${updateError.message}`,
      );
    }

    // ==========================================
    // 3. GIAO KHOÁN CHO SERVICE XỬ LÝ AI
    // ==========================================
    try {
      await RecommendationService.generateForBatch(currentBatchUserIds);
    } catch (batchError) {
      console.error(
        "[AI_BATCH_FAILED] Lỗi tạo gợi ý, đang Rollback mềm...",
        batchError,
      );

      // ROLLBACK MỀM: Lùi thời gian về 24h trước thay vì set null.
      // Tránh việc QStash vừa chạy mẻ tiếp theo lại bốc trúng đúng 4 ông này gây Loop vô tận.
      // Đêm mai họ sẽ lại là những người được ưu tiên cao nhất.
      const yesterday = new Date(
        Date.now() - 24 * 60 * 60 * 1000,
      ).toISOString();
      await supabaseAdmin
        .from("profiles")
        .update({ last_ai_recommendation_at: yesterday })
        .in("id", currentBatchUserIds);
    }

    const newTotalProcessed = totalProcessed + currentBatchUserIds.length;

    // Dừng an toàn nếu đã đạt quota của đêm nay
    if (newTotalProcessed >= MAX_USERS_PER_RUN) {
      return NextResponse.json({
        success: true,
        message: `Đã đạt giới hạn ${MAX_USERS_PER_RUN} users. Dừng chu trình để tối ưu chi phí.`,
      });
    }

    // Nghỉ giải lao làm mát Rate Limit của Gemini (15 giây)
    await sleep(15000);

    // ==========================================
    // 4. LÊN LỊCH CHẠY MẺ TIẾP THEO BẰNG QSTASH
    // ==========================================
    const qstashToken = process.env.QSTASH_TOKEN;
    const qstashUrl = process.env.QSTASH_URL;
    const rawBaseUrl = process.env.NEXT_PUBLIC_PORT;

    if (qstashToken && qstashUrl && rawBaseUrl) {
      const cleanBaseUrl = rawBaseUrl.replace(/^https?:\/\//, "");
      const targetUrl = `https://${cleanBaseUrl}/api/recommend/user`;

      const response = await fetch(`${qstashUrl}/v2/publish/${targetUrl}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${qstashToken}`,
          "Content-Type": "application/json",
          "Upstash-Delay": "10s",
          "Upstash-Forward-Authorization": `Bearer ${cronSecret}`,
        },
        body: JSON.stringify({ totalProcessed: newTotalProcessed }),
      });

      if (!response.ok) {
        console.error("QStash publish failed:", await response.text());
        return NextResponse.json(
          { error: "Lỗi không thể lên lịch QStash cho mẻ tiếp theo" },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        message: `Đã xử lý xong ${newTotalProcessed} users. Đã lên lịch QStash chạy lô tiếp theo.`,
      });
    } else {
      console.warn("Missing QSTASH_TOKEN or NEXT_PUBLIC_PORT. Dừng đệ quy.");
      return NextResponse.json({
        success: false,
        message: `Đã xử lý ${newTotalProcessed} users. Không thể chạy tiếp do thiếu Config môi trường.`,
      });
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[CRON_AI_ERROR]:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
