import { cache } from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";

// Services & Types
import { MovieService } from "@/services/movie.service";
import { MovieQueryParams } from "@/types";

// Components
import MovieCard from "@/components/shared/MovieCard";
import MovieFilter from "@/app/(main)/[movieType]/_components/MovieFilter";

const Pagination = dynamic(
  () => import("@/app/(main)/[movieType]/_components/Pagination"),
  {
    ssr: false,
  },
);

interface PageProps {
  params: { movieType: string };
  searchParams: Record<string, string | undefined>;
}

/**
 * Memoized fetcher: Đảm bảo Metadata và Page không gọi API trùng lặp.
 * Tự động phân luồng giữa Search và List.
 */
const getMoviesData = cache(
  async (
    movieType: string,
    searchParams: Record<string, string | undefined>,
  ) => {
    const keyword = searchParams.keyword;
    const parsedPage = parseInt(searchParams.page || "1", 10);
    const page = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
    const limit = 24;
    // Nếu có keyword hoặc slug là tim-kiem -> Gọi service Search
    if (keyword || movieType === "tim-kiem") {
      return await MovieService.search(keyword || "", page, limit);
    }

    // Ngược lại gọi service GetList (Thể loại, Quốc gia, Phim bộ/lẻ...)
    const filters: MovieQueryParams = {
      slug: movieType,
      page,
      limit,
      category: searchParams.category,
      country: searchParams.country,
      year: searchParams.year,
      sort_field: searchParams.sort_field,
    };

    return await MovieService.getList(filters);
  },
);

/**
 * SEO Metadata
 */
export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  try {
    const data = await getMoviesData(params.movieType, searchParams);
    if (!data?.seoOnPage) return { title: "Danh sách phim" };

    const { seoOnPage } = data;

    return {
      title: seoOnPage.titleHead,
      description: seoOnPage.descriptionHead,
      openGraph: {
        title: seoOnPage.titleHead,
        description: seoOnPage.descriptionHead,
        images: seoOnPage.og_image,
        type: "website",
      },
      alternates: {
        canonical: seoOnPage.og_url,
      },
    };
  } catch {
    return { title: "Phim mới cập nhật" };
  }
}

export default async function MoviesPage({ params, searchParams }: PageProps) {
  const data = await getMoviesData(params.movieType, searchParams);

  if (!data || !data.items) return notFound();

  const pagination = data.params?.pagination;
  const currentPage = pagination?.currentPage || 1;
  const totalItems = pagination?.totalItems || 0;
  const totalItemsPerPage = pagination?.totalItemsPerPage || 24;
  const totalPages = Math.ceil(totalItems / totalItemsPerPage);
  return (
    <div className="col-span-12 xl:col-span-8 py-4 space-y-4 sm:space-y-8 animate-in fade-in duration-500">
      {/* Thanh lọc phim và Breadcrumb */}
      <MovieFilter breadCrumb={data.breadCrumb} />

      {/* Hiển thị tổng kết quả nếu là trang tìm kiếm */}
      {searchParams.keyword && (
        <div className="text-zinc-400 text-sm">
          Tìm thấy{" "}
          <span className="text-primary font-bold">
            {totalItems.toLocaleString()}
          </span>{" "}
          kết quả cho từ khóa:
          <span className="italic"> &ldquo;{searchParams.keyword}&rdquo;</span>
        </div>
      )}

      {/* Danh sách Phim */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
        {data.items.length > 0 ? (
          data.items.map((movie) => (
            <MovieCard
              key={movie._id}
              movie_slug={movie.slug}
              name={movie.name}
              thumb_url={movie.thumb_url}
              episode_current={movie.episode_current}
            />
          ))
        ) : (
          <div className="col-span-full py-20 text-center space-y-4">
            <p className="text-zinc-500">
              Rất tiếc, chúng tôi không tìm thấy phim nào phù hợp với yêu cầu
              của bạn.
            </p>
            <Link
              href="/"
              className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl font-medium transition"
            >
              Quay lại Trang chủ
            </Link>
          </div>
        )}
      </div>

      {/* Phân trang */}
      {totalPages > 1 && (
        <div className="pt-8 border-t border-zinc-800/50">
          <Pagination currentPage={currentPage} totalPages={totalPages} />
        </div>
      )}
    </div>
  );
}
