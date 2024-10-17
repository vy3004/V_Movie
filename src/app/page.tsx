import Container from "@/components/Container";
import HeroCarousel from "@/components/HeroCarousel";
import MovieSection from "@/components/MovieSection";
import Banner from "@/components/Banner";
import ListMovieSection from "@/components/ListMovieSection";

import { fetchMovies } from "@/lib/apiClient";
import { typesMovie } from "@/lib/configs";

const currentYear = new Date().getFullYear();

export async function generateMetadata() {
  const dataNewMovies = await fetchMovies(
    typesMovie.NEW.slug,
    "1",
    currentYear.toString()
  );

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
  const dataNewMovies = await fetchMovies(
    typesMovie.NEW.slug,
    "1",
    currentYear.toString()
  );

  const isData = dataNewMovies.items.length > 0;

  return (
    <div className="col-span-12 select-none">
      {isData && (
        <>
          <HeroCarousel movies={dataNewMovies.items.slice(0, 6)} />

          <Container className="-mt-60">
            <MovieSection
              title="Đề xuất hot"
              movies={dataNewMovies.items.slice(6)}
            />
          </Container>
        </>
      )}

      <Container className={`${isData ? "mt-12" : "mt-20"} mb-12 space-y-12`}>
        <Banner />

        <ListMovieSection />
      </Container>
    </div>
  );
}
