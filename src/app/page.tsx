import { cache, Suspense } from "react";
import dynamicImport from "next/dynamic";
import { Metadata } from "next";

import { MovieService } from "@/services/movie.service";
import { shuffleMovies } from "@/lib/utils";

import Container from "@/components/Container";
import HeroCarousel from "@/components/HeroCarousel";
import ListMovieSection from "@/components/ListMovieSection";
import HistorySection from "@/components/HistorySection";
import SubscriptionSection from "@/components/SubscriptionSection";
import WatchPartyBanner from "@/components/watch-party/WatchPartyBanner";
import TopMovieSection from "@/components/TopMovieSection";
const Banner = dynamicImport(() => import("@/components/Banner"), {
  ssr: false,
});

export const revalidate = 3600;

const getHomeData = cache(async () => {
  return await MovieService.getList({ limit: 16 });
});

const Skeleton = ({ children }: { children: React.ReactNode }) => (
  <Suspense
    fallback={<div className="h-200 animate-pulse bg-zinc-900 rounded-xl" />}
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

    return {
      title: data.seoOnPage.titleHead,
      description: data.seoOnPage.descriptionHead,
      openGraph: {
        title: data.seoOnPage.titleHead,
        description: data.seoOnPage.descriptionHead,
        images: data.seoOnPage.og_image,
        type: "website",
      },
      alternates: {
        canonical: data.seoOnPage.og_url,
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
