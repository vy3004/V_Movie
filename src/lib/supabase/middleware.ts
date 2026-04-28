import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. KIỂM TRA ROUTE TRƯỚC TIÊN (Early Exit)
  const isProtectedRoute = pathname.startsWith("/dashboard");

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // 2. TỐI ƯU GỌI MẠNG (Chỉ gọi DB khi vào route bảo mật)
  // Tránh việc trang chủ phải chờ 200ms để check user
  if (isProtectedRoute) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Nếu không có user mà dám vào route bảo mật -> Đuổi về trang chủ
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("auth", "required");
      return NextResponse.redirect(url);
    }
  }

  // Đối với các trang public, ta cứ cho đi qua mượt mà
  return supabaseResponse;
}
