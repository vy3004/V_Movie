import dynamic from "next/dynamic";
import { Metadata } from "next";
import Container from "@/components/ui/Container";
import MovieSection from "@/components/shared/MovieSection";
import HeroCarousel from "@/app/(main)/_components/HeroCarousel";
import TopMovieSection from "@/app/(main)/_components/TopMovieSection";
import WatchPartyBanner from "@/app/(main)/_components/WatchPartyBanner";
import Banner from "@/app/(main)/_components/Banner";
import { IndexedMovieService } from "@/services/indexed-movie.service";
import { shuffleMovies } from "@/lib/utils";

const RecommendSection = dynamic(() => import("@/app/(main)/_components/RecommendSection"), { ssr: false });
const HistorySection = dynamic(() => import("@/app/(main)/_components/HistorySection"), { ssr: false });
const SubscriptionSection = dynamic(() => import("@/app/(main)/_components/SubscriptionSection"), { ssr: false });

export const revalidate = 21600;

export const metadata: Metadata = {
  title: "V · Movie | Xem phim online chất lượng cao",
  description:
    "Khám phá phim mới, phim lẻ, phim bộ, hoạt hình và TV shows được cập nhật liên tục tại V · Movie.",
  openGraph: {
    title: "V · Movie | Xem phim online chất lượng cao",
    description:
      "Khám phá phim mới, phim lẻ, phim bộ, hoạt hình và TV shows được cập nhật liên tục tại V · Movie.",
    type: "website",
    siteName: "V · Movie",
  },
};

export default async function HomePage() {
  const { latest, sections } = await IndexedMovieService.getHomePagePayload(
    new Date().getFullYear(),
    16,
    12,
  );
  const shuffledItems = shuffleMovies(latest.movies);
  const visibleSections = sections.filter((section) => section.result.movies.length >= 4);

  return (
    <main className="col-span-12 select-none">
      {shuffledItems.length > 0 ? (
        <>
          <HeroCarousel movies={shuffledItems.slice(0, 6)} />
          <Container className="-mt-[5%] md:-mt-[6%] lg:-mt-[8%] xl:-mt-[16%] relative z-10">
            <TopMovieSection movies={shuffledItems.slice(6)} />
          </Container>
        </>
      ) : null}

      <Container className="mt-6 sm:mt-12">
        <RecommendSection />
        <HistorySection title="Tiếp tục xem" type="watching" />
      </Container>

      <WatchPartyBanner />

      <Container className="mt-6 sm:mt-12">
        <SubscriptionSection />
        <HistorySection title="Phim đã xem" type="finished" />
        <Banner />

        <div className="space-y-6 sm:space-y-12 mt-6 sm:mt-12">
          {visibleSections.map((section) => (
            <MovieSection
              key={section.slug}
              title={section.title}
              movies={section.result.movies}
              hrefViewMore={section.slug}
            />
          ))}
        </div>
      </Container>
    </main>
  );
}
