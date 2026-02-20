import { cache } from "react";
import dynamic from "next/dynamic";

import Container from "@/components/Container";
import HeroCarousel from "@/components/HeroCarousel";
import MovieSection from "@/components/MovieSection";
import ListMovieSection from "@/components/ListMovieSection";
const Banner = dynamic(() => import("@/components/Banner"), { ssr: false });

import { fetchMoviesWithFallback } from "@/lib/apiClient";
import { typesMovie } from "@/lib/configs";

export const revalidate = 3600;

const getNewMovies = cache(async () => {
  return await fetchMoviesWithFallback(typesMovie.NEW.slug, 24);
});


export async function generateMetadata() {
  const dataNewMovies = await getNewMovies();

  return {
    title: dataNewMovies.seoOnPage.titleHead,
    description: dataNewMovies.seoOnPage.descriptionHead,
    openGraph: {
      title: dataNewMovies.seoOnPage.titleHead,
      name: dataNewMovies.seoOnPage.titleHead,
      description: dataNewMovies.seoOnPage.descriptionHead,
      images: dataNewMovies.seoOnPage.og_image,
      type: dataNewMovies.seoOnPage.og_type,
    },
  };
}

export default async function HomePage() {
  const dataNewMovies = await getNewMovies();

  const isData = dataNewMovies.items.length > 0;

  const shuffledItems = isData
  ? [...dataNewMovies.items].sort(() => 0.5 - Math.random())
  : [];

  return (
    <main className="col-span-12 select-none">
      {isData && (
        <>
          <HeroCarousel movies={shuffledItems.slice(0, 6)} />

          <Container className="mt-4 lg:-mt-[8%] xl:-mt-[16%]">
            <MovieSection
              title="Đề xuất hot"
              movies={shuffledItems.slice(6)}
            />
          </Container>
        </>
      )}

      <Container
        className={`${
          isData ? "mt-6 sm:mt-12" : "mt-10 sm:mt-20"
        } mb-12 space-y-6 sm:space-y-12`}
      >
        <Banner />

        <ListMovieSection />
      </Container>
    </main>
  );
}
