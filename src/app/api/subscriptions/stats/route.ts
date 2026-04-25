import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { SubscriptionService } from "@/services/subscription.service";

export const runtime = "edge";

export async function GET(req: Request) {
  try {
    const supabase = await createSupabaseServer();

    // 1. Kiểm tra quyền truy cập
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    // 2. Kiểm tra tham số đầu vào
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    // Đảm bảo user chỉ có thể lấy stats của chính mình
    if (userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3. Lấy thống kê từ Service (Ưu tiên Redis -> Fallback DB)
    const stats = await SubscriptionService.getStats(userId);

    // Trả về kết quả: { total: number, hasNewCount: number }
    return NextResponse.json(stats);
  } catch (error) {
    console.error("[Subscription Stats API Error]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
