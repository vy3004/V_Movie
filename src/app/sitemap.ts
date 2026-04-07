import type { MetadataRoute } from "next";
import { BASE_URL, typesMovie, apiConfig } from "@/lib/configs";
import { Movie } from "@/lib/types";

// Nếu muốn sitemap tĩnh hoàn toàn (chỉ build 1 lần): bỏ revalidate
export const revalidate = 24 * 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];

  try {
    const currentYear = new Date().getFullYear().toString();
    // Gọi API trực tiếp bằng fetch, yêu cầu cache mạnh
    const url = `${apiConfig.MOVIES_URL}${typesMovie.NEW.slug}?year=${currentYear}&sort_field=tmdb.vote_count`;
    const res = await fetch(url, {
      cache: "force-cache",
    });
    const data = await res.json();
    const newMovies = data.data?.items || [];

    const movieTypeRoutes = Object.values(typesMovie).map((type) => ({
      url: `${BASE_URL}/${type.slug}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    }));

    const detailedMovieRoutes = newMovies.map((movie: Movie) => ({
      url: `${BASE_URL}/phim/${movie.slug}`,
      lastModified: new Date(
        movie.modified?.time || movie.created?.time || new Date(),
      ),
      changeFrequency: "weekly",
      priority: 0.6,
    }));

    return [...staticRoutes, ...movieTypeRoutes, ...detailedMovieRoutes];
  } catch (error) {
    console.error("Error generating sitemap:", error);
    return staticRoutes;
  }
}
