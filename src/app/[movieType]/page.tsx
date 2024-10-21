import Link from "next/link";

import MovieCard from "@/components/MovieCard";
import MovieFilter from "@/components/MovieFilter";
import Pagination from "@/components/Pagination";

import { fetchMovies } from "@/lib/apiClient";

interface PageProps {
  params: { movieType: string };
  searchParams: Record<string, string | undefined>;
}

export async function generateMetadata({ params, searchParams }: PageProps) {
  const data = await fetchMovies(params.movieType, searchParams);

  if (!data?.seoOnPage) return null;

  return {
    title: data.seoOnPage.titleHead,
    description: data.seoOnPage.descriptionHead,
    openGraph: {
      title: data.seoOnPage.titleHead,
      name: data.seoOnPage.titleHead,
      description: data.seoOnPage.descriptionHead,
      images: data.seoOnPage.og_image,
      type: data.seoOnPage.og_type,
    },
  };
}

export default async function MoviesPage({ params, searchParams }: PageProps) {
  const data = await fetchMovies(params.movieType, searchParams);

  const { pagination } = data.params;
  const currentPage = pagination.currentPage || 1;
  const totalItems = pagination.totalItems || 0;
  const totalItemsPerPage = pagination.totalItemsPerPage || 24;
  const totalPages = Math.ceil(totalItems / totalItemsPerPage);

  return (
    <div className="col-span-12 xl:col-span-8 py-4 space-y-8">
      <MovieFilter breadCrumb={data.breadCrumb} />

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {data.items.length > 0 ? (
          data.items.map((movie) => <MovieCard key={movie._id} movie={movie} />)
        ) : (
          <>
            <p>Không tìm thấy phim phù hợp</p>
            <Link
              href={data.params.type_slug}
              className="w-fit bg-primary rounded px-1"
            >
              Quay lại
            </Link>
          </>
        )}
      </div>

      {totalPages > 1 && (
        <Pagination currentPage={currentPage} totalPages={totalPages} />
      )}
    </div>
  );
}
