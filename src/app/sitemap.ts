import type { MetadataRoute } from "next";

import { fetchMovies } from "@/lib/apiClient";
import { BASE_URL, typesMovie } from "@/lib/configs";

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
    const newMovies = await fetchMovies(typesMovie.NEW.slug, {
      year: currentYear,
    });

    const movieTypeRoutes = Object.values(typesMovie).map((type) => ({
      url: `${BASE_URL}/${type.slug}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    }));

    const detailedMovieRoutes = await Promise.all(
      newMovies.items.map(async (movie) => {
        const { slug } = movie;
        return {
          url: `${BASE_URL}/phim/${slug}`,
          lastModified: new Date(
            movie.modified.time || movie.created.time || new Date()
          ),
          changeFrequency: "weekly",
          priority: 0.6,
        };
      })
    );

    return [
      ...staticRoutes,
      ...movieTypeRoutes,
      ...detailedMovieRoutes,
    ] as MetadataRoute.Sitemap;
  } catch (error) {
    console.error("Error generating sitemap:", error);
    return staticRoutes;
  }
}
