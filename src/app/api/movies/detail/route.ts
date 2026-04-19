import { NextResponse } from "next/server";
import { MovieService } from "@/services/movie.service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  if (!slug)
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  try {
    const data = await MovieService.getDetail(slug);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[API_MOVIES_DETAIL_GET]:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
