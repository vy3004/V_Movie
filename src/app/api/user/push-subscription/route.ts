import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "edge";

// ==========================================
// ĐĂNG KÝ (BẬT THÔNG BÁO ĐẨY)
// ==========================================
export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { subscription } = await req.json();

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json(
        { error: "Invalid subscription payload" },
        { status: 400 },
      );
    }

    // 1. DỌN RÁC (Admin): Quét sạch các user khác đang xài chung thiết bị/trình duyệt này
    await supabaseAdmin
      .from("push_subscriptions")
      .delete()
      .eq("subscription->>endpoint", subscription.endpoint);

    // 2. LƯU MỚI (User): Gắn thiết bị này cho user đang đăng nhập
    const { error } = await supabase.from("push_subscriptions").insert({
      user_id: user.id,
      subscription: subscription,
    });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Đã lưu thiết bị thành công",
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[API_PUSH_SUB_POST]:", errorMessage);

    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống khi đăng ký thiết bị" },
      { status: 500 },
    );
  }
}

// ==========================================
// HỦY ĐĂNG KÝ (TẮT THÔNG BÁO ĐẨY)
// ==========================================
export async function DELETE(req: Request) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { endpoint } = await req.json();

    if (!endpoint) {
      return NextResponse.json(
        { error: "Missing endpoint parameter" },
        { status: 400 },
      );
    }

    // Xóa thiết bị của chính user này dựa trên chuỗi endpoint
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("subscription->>endpoint", endpoint)
      .eq("user_id", user.id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Đã xóa thiết bị thành công",
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[API_PUSH_SUB_DELETE]:", errorMessage);

    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống khi xóa thiết bị" },
      { status: 500 },
    );
  }
}
