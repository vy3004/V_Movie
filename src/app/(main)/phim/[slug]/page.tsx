import { cache } from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";

// Services
import { MovieService } from "@/services/movie.service";
import { HistoryService } from "@/services/history.service";
import { createSupabaseServer } from "@/lib/supabase/server";

// Components
import BreadCrumb from "@/components/layout/BreadCrumb";
import MovieDetail from "@/components/shared/MovieDetail";
import TrailerPlayer from "@/components/shared/TrailerPlayer";
import WatchMovie from "@/app/(main)/phim/[slug]/_components/WatchMovie";

interface PageProps {
  params: { slug: string };
  searchParams: { tap?: string };
}

const getMovieDetail = cache(async (slug: string) => {
  return await MovieService.getDetail(slug);
});

/**
 * Tạo Metadata động cho SEO
 */
export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const data = await getMovieDetail(params.slug);

  if (!data?.item) return { title: "Không tìm thấy phim" };

  const { seoOnPage } = data;
  if (!seoOnPage) return { title: data.item.name || "Chi tiết phim" };

  const tap = searchParams.tap;

  const title = tap
    ? `${seoOnPage.titleHead} | Tập ${tap}`
    : seoOnPage.titleHead;

  return {
    title: title,
    description: seoOnPage.descriptionHead,
    openGraph: {
      title: title,
      description: seoOnPage.descriptionHead,
      images: seoOnPage.og_image,
      url: seoOnPage.og_url,
      type: "video.movie",
    },
    alternates: {
      canonical: seoOnPage.og_url,
    },
  };
}

export default async function MoviePage({ params }: PageProps) {
  const { slug } = params;

  // 1. Khởi tạo Supabase và lấy thông tin User
  const supabase = await createSupabaseServer();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;

  // 2. Gọi API Dữ liệu phim
  const data = await getMovieDetail(slug);
  const movie = data?.item;

  if (!movie) return notFound();

  // 3. KIỂM TRA XEM PHIM CÓ TẬP NÀO HỢP LỆ KHÔNG (CÓ SLUG & LINK M3U8)
  const hasValidEpisodes = movie.episodes?.some((server) =>
    server.server_data?.some((ep) => ep.slug !== "" && ep.link_m3u8 !== ""),
  );

  // 4. Chỉ tải lịch sử xem nếu có tập hợp lệ (đỡ tốn request db)
  let history = null;
  if (hasValidEpisodes && user) {
    history = await HistoryService.getLatest(user.id, slug);
  }

  return (
    <div className="col-span-12 xl:col-span-8 py-4 space-y-4 sm:space-y-8 animate-in fade-in duration-500">
      <BreadCrumb breadCrumb={data.breadCrumb} />

      <MovieDetail movie={movie} />

      {/* RENDER ĐIỀU KIỆN TỪ SERVER */}
      {hasValidEpisodes ? (
        <WatchMovie movie={movie} history={history} user={user} />
      ) : (
        <TrailerPlayer movie={movie} user={user} />
      )}

      {data.seoOnPage.seoSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(data.seoOnPage.seoSchema).replace(
              /<\/script/gi,
              "<\\/script",
            ),
          }}
        />
      )}
    </div>
  );
}
