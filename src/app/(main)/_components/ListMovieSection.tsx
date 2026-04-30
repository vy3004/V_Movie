import { Suspense } from "react";
import ServerMovieSection from "./ServerMovieSection";
import MovieSectionSkeleton from "@/components/shared/MovieSectionSkeleton";
import { typesMovie } from "@/lib/configs";

const SECTIONS = [
  { type: "CHIEU_RAP", config: typesMovie.CHIEU_RAP },
  { type: "SINGLE", config: typesMovie.SINGLE },
  { type: "SERIES", config: typesMovie.SERIES },
  { type: "TV_SHOWS", config: typesMovie.TV_SHOWS },
  { type: "ANIME", config: typesMovie.ANIME },
];

const ListMovieSection = () => {
  return (
    <div className="space-y-6 sm:space-y-12 mt-6 sm:mt-12">
      {SECTIONS.map((section) => (
        <Suspense key={section.type} fallback={<MovieSectionSkeleton />}>
          <ServerMovieSection
            title={section.config.name}
            slug={section.config.slug}
          />
        </Suspense>
      ))}
    </div>
  );
};

export default ListMovieSection;
