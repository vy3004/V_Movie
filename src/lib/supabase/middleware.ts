import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
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

  // 1. Lấy thông tin user (Quan trọng: getUser() bảo mật hơn getSession())
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 2. Định nghĩa các nhóm Route
  const isAuthPage = request.nextUrl.pathname.startsWith("/login");
  const isProtectedRoute =
    request.nextUrl.pathname.startsWith("/profile") ||
    request.nextUrl.pathname.startsWith("/watchlist") ||
    request.nextUrl.pathname.startsWith("/watch-party") ||
    request.nextUrl.pathname.startsWith("/history");

  // 3. Logic điều hướng (Route Guard)

  // TRƯỜNG HỢP A: Vào trang bảo mật mà CHƯA đăng nhập -> Đá về /login
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/"; // Quay về trang chủ
    url.searchParams.set("auth", "required"); // Thêm dấu hiệu yêu thích
    return NextResponse.redirect(url);
  }

  // TRƯỜNG HỢP B: Đã đăng nhập mà cố tình vào trang /login -> Đá về trang chủ
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
