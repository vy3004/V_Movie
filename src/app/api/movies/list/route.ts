import { NextResponse } from "next/server";
import { MovieService } from "@/services/movie.service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug") || "phim-moi-cap-nhat";
    const page = parseInt(searchParams.get("page") || "1", 10) || 1;
    const limit = parseInt(searchParams.get("limit") || "24", 10) || 24;

    let data;

    if (slug === "tim-kiem") {
      const keyword = searchParams.get("keyword") || "";
      // Gọi hàm search riêng biệt
      data = await MovieService.search(keyword, page, limit);
    } else {
      // Thu thập các filter khác cho getList
      const filters = {
        category: searchParams.get("category") || "",
        country: searchParams.get("country") || "",
        year: searchParams.get("year") || "",
        sort_field: searchParams.get("sort_field") || "",
      };
      data = await MovieService.getList({ slug, page, limit, ...filters });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
