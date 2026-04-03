import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Khớp tất cả các đường dẫn ngoại trừ:
     * - api (các route API)
     * - _next/static (file tĩnh của Nextjs)
     * - _next/image (tối ưu ảnh)
     * - favicon.ico (biểu tượng web)
     * - Các file mở rộng: .svg, .png, .jpg, .jpeg, .gif, .webp
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
