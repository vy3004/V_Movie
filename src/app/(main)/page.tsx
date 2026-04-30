import dynamic from "next/dynamic";
import { cache } from "react";
import { Metadata } from "next";

import { MovieService } from "@/services/movie.service";
import { shuffleMovies } from "@/lib/utils";

import Container from "@/components/ui/Container";
import HeroCarousel from "@/app/(main)/_components/HeroCarousel";
import TopMovieSection from "@/app/(main)/_components/TopMovieSection";
import RecommendSection from "@/app/(main)/_components/RecommendSection";
import ListMovieSection from "@/app/(main)/_components/ListMovieSection";
const HistorySection = dynamic(
  () => import("@/app/(main)/_components/HistorySection"),
  { ssr: false },
);
const SubscriptionSection = dynamic(
  () => import("@/app/(main)/_components/SubscriptionSection"),
  { ssr: false },
);
const WatchPartyBanner = dynamic(
  () => import("@/app/(main)/_components/WatchPartyBanner"),
  { ssr: false },
);
const Banner = dynamic(() => import("@/app/(main)/_components/Banner"), {
  ssr: false,
});

export const revalidate = 3600;

const getHomeData = cache(async () => {
  return await MovieService.getList({ limit: 16 });
});

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
        <RecommendSection />
        <HistorySection title="Tiếp tục xem" type="watching" />
      </Container>

      <WatchPartyBanner />

      <Container className="mt-6 sm:mt-12">
        <SubscriptionSection />
        <HistorySection title="Phim đã xem" type="finished" />

        <Banner />

        {/* Danh sách các thể loại phim khác */}
        <ListMovieSection />
      </Container>
    </main>
  );
}
