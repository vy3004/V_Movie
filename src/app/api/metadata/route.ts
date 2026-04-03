import { NextResponse } from "next/server";
import { fetchCategories, fetchCountries } from "@/lib/apiClient";

export async function GET() {
  try {
    const [categories, countries] = await Promise.all([
      fetchCategories(),
      fetchCountries(),
    ]);
    return NextResponse.json({ categories, countries });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch metadata" },
      { status: 500 },
    );
  }
}
