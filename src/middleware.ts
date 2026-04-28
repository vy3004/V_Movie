import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Khớp tất cả các đường dẫn ngoại trừ:
     * - api (các route API tự xử lý auth riêng)
     * - _next/static (file tĩnh của Next.js)
     * - _next/image (API tối ưu ảnh của Next.js)
     * - favicon.ico (biểu tượng web)
     * - Các tệp hình ảnh: svg, png, jpg, jpeg, gif, webp, avif
     * - ĐẶC BIỆT CHO PHIM: mp4, m3u8, ts (HLS video), vtt (phụ đề)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|mp4|m3u8|ts|vtt)$).*)",
  ],
};
