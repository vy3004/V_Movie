import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "edge";

// ==========================================
// ĐĂNG KÝ (BẬT THÔNG BÁO ĐẨY)
// ==========================================
export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { subscription } = await req.json();

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json(
        { error: "Invalid subscription" },
        { status: 400 },
      );
    }

    // 1. Xóa các đăng ký cũ bị trùng endpoint (Tránh 1 trình duyệt bị lưu 2 lần)
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("subscription->>endpoint", subscription.endpoint)
      .eq("user_id", user.id);
    // 2. Thêm đăng ký mới vào DB
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
    console.error("[API_PUSH_SUB_POST]:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống không xác định" },
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

  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { endpoint } = await req.json();

    if (!endpoint) {
      return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
    }

    // Xóa thiết bị khỏi DB dựa vào chuỗi endpoint duy nhất của trình duyệt
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("subscription->>endpoint", endpoint)
      .eq("user_id", user.id); // Check thêm user_id cho bảo mật

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Đã xóa thiết bị thành công",
    });
  } catch (error: unknown) {
    console.error("[API_PUSH_SUB_DELETE]:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi hệ thống không xác định" },
      { status: 500 },
    );
  }
}
