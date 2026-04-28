import LazyMovieSection from "@/app/(main)/_components/LazyMovieSection";
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
    <div className="space-y-6 sm:space-y-12">
      {SECTIONS.map((section) => (
        <LazyMovieSection
          key={section.type}
          title={section.config.name}
          slug={section.config.slug}
        />
      ))}
    </div>
  );
};

export default ListMovieSection;
