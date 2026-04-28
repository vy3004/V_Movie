import { cache, Suspense } from "react";
import dynamicImport from "next/dynamic";
import { Metadata } from "next";

import { MovieService } from "@/services/movie.service";
import { shuffleMovies } from "@/lib/utils";

import Container from "@/components/ui/Container";
import ListMovieSection from "@/app/(main)/_components/ListMovieSection";
import HistorySection from "@/app/(main)/_components/HistorySection";
import SubscriptionSection from "@/app/(main)/_components/SubscriptionSection";
import HeroCarousel from "@/app/(main)/_components/HeroCarousel";
import WatchPartyBanner from "@/app/(main)/_components/WatchPartyBanner";
import TopMovieSection from "@/app/(main)/_components/TopMovieSection";
const Banner = dynamicImport(() => import("@/app/(main)/_components/Banner"), {
  ssr: false,
});

export const revalidate = 3600;

const getHomeData = cache(async () => {
  return await MovieService.getList({ limit: 16 });
});

const Skeleton = ({ children }: { children: React.ReactNode }) => (
  <Suspense
    fallback={
      <div className="h-[200px] animate-pulse bg-zinc-900 rounded-xl" />
    }
  >
    {children}
  </Suspense>
);
/**
 * SEO Metadata
 */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const data = await getHomeData();
    const seo = data.seoOnPage;

    if (!seo) throw new Error("SEO data not available");

    return {
      title: seo.titleHead,
      description: seo.descriptionHead,
      openGraph: {
        title: seo.titleHead,
        description: seo.descriptionHead,
        images: seo.og_image,
        type: "website",
      },
      alternates: {
        canonical: seo.og_url,
      },
    };
  } catch {
    return {
      title: "V_Movie - Xem phim online",
      description: "Nền tảng xem phim chất lượng cao",
    };
  }
}

export default async function HomePage() {
  // Lấy dữ liệu từ bản ghi đã được memoized ở bước Metadata
  const dataNewMovies = await getHomeData();
  const movies = dataNewMovies.items || [];
  const hasData = movies.length > 0;

  // Xử lý xáo trộn phim cho cảm giác mới mẻ (chỉ thực hiện ở Server)
  const shuffledItems = shuffleMovies(movies);

  return (
    <main className="col-span-12 select-none">
      {hasData && (
        <>
          {/* Banner Hero: Lấy 6 phim đầu sau khi xáo trộn */}
          <HeroCarousel movies={shuffledItems.slice(0, 6)} />

          <Container className="-mt-[5%] md:-mt-[6%] lg:-mt-[8%] xl:-mt-[16%] relative z-10">
            <TopMovieSection movies={shuffledItems.slice(6)} />
          </Container>
        </>
      )}

      <Container className="mt-6 sm:mt-12">
        <Skeleton>
          <HistorySection title="Tiếp tục xem" type="watching" />
        </Skeleton>
      </Container>

      <WatchPartyBanner />

      <Container
        className={`${
          hasData ? "mt-6 sm:mt-12" : "mt-10 sm:mt-20"
        } mb-12 space-y-6 sm:space-y-12`}
      >
        {/* Các Section mang tính cá nhân hóa dùng Suspense để không chặn luồng render chính */}
        <Suspense
          fallback={
            <div className="h-20 animate-pulse bg-zinc-900 rounded-xl" />
          }
        >
          <SubscriptionSection />
          <HistorySection title="Phim đã xem" type="finished" />
        </Suspense>

        <Banner />

        {/* Danh sách các thể loại phim khác */}
        <ListMovieSection />
      </Container>
    </main>
  );
}
