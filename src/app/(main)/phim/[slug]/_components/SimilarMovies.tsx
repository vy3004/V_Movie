import MovieCard from "@/components/shared/MovieCard";
import { MovieService } from "@/services/movie.service";

interface SimilarMoviesProps {
  currentSlug: string;
  typeSlug: string;
  genres: { slug: string; name: string }[];
  countries: { slug: string; name: string }[];
}

export default async function SimilarMovies({
  currentSlug,
  typeSlug,
  genres,
  countries,
}: SimilarMoviesProps) {
  let movies;
  try {
    movies = await MovieService.getSimilarMovies(
      currentSlug,
      typeSlug,
      genres,
      countries,
      12,
    );
  } catch (error) {
    console.error("Failed to fetch similar movies:", error);
    return null;
  }

  if (!movies || movies.length === 0) return null;

  return (
    <section className="bg-background p-4 sm:p-6 rounded-xl border border-zinc-800/50 space-y-6 scroll-mt-24">
      <h3 className="text-lg font-bold text-white tracking-wider flex items-center gap-2">
        <span className="w-1.5 h-5 bg-red-600 rounded-full shadow-[0_0_12px_rgba(220,38,38,0.5)]"></span>
        Có thể bạn sẽ thích
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4 lg:gap-5">
        {movies.map((movie) => {
          return (
            <MovieCard
              key={movie.slug}
              movie_slug={movie.slug}
              name={movie.name}
              thumb_url={movie.thumb_url}
              episode_current={movie.episode_current}
            />
          );
        })}
      </div>
    </section>
  );
}
