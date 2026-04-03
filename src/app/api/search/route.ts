// src/app/api/search/route.ts
import { NextResponse } from "next/server";
import { fetchMovies } from "@/lib/apiClient";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get("keyword");

  if (!keyword) {
    return NextResponse.json([]);
  }

  try {
    const result = await fetchMovies("tim-kiem", { keyword });

    return NextResponse.json(result.items || []);
  } catch (error) {
    console.error("Search API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
