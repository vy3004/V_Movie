import { NextResponse } from "next/server";
import { MovieService } from "@/services/movie.service";

export async function GET() {
  try {
    const { data, source } = await MovieService.getMetadata();

    return NextResponse.json(data, {
      status: 200,
      headers: {
        "X-Cache": source,
        /**
         * public: Cho phép cache mọi nơi.
         * max-age=31536000: Trình duyệt cache 1 năm.
         * s-maxage=31536000: CDN (Vercel) cache 1 năm.
         * immutable: Không revalidate (kiểm tra lại) dữ liệu nếu chưa hết hạn.
         */
        "Cache-Control":
          "public, max-age=31536000, s-maxage=31536000, immutable",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
