"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { StarIcon } from "@heroicons/react/24/solid";

import Loading from "@/components/Loading";
import { Badge, BorderedItem } from "@/components/MovieDetail";

import { Movie } from "@/lib/types";
import { apiConfig } from "@/lib/configs";

import { useData } from "@/providers/BaseDataContextProvider";

type TabType = "day" | "month" | "year";
const Sidebar = () => {
  const pathName = usePathname();
  const { topMovies } = useData();

  const [activeTab, setActiveTab] = useState<TabType>("day");

  if (pathName === "/") return null;

  const renderMovieList = () => {
    switch (activeTab) {
      case "year":
        return <MovieList movies={topMovies.year} />;
      case "month":
        return <MovieList movies={topMovies.month} />;
      case "day":
      default:
        return <MovieList movies={topMovies.day} />;
    }
  };

  return (
    <div className="col-span-12 xl:col-span-4 py-3.5 px-4 rounded-lg bg-background">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-primary font-bold uppercase">Top phim hot</h2>

        <div className="flex items-center gap-2">
          <TabButton
            title="Ngày"
            activeTab={activeTab}
            tabType="day"
            onClick={setActiveTab}
          />
          <TabButton
            title="Tháng"
            activeTab={activeTab}
            tabType="month"
            onClick={setActiveTab}
          />
          <TabButton
            title="Năm"
            activeTab={activeTab}
            tabType="year"
            onClick={setActiveTab}
          />
        </div>
      </div>

      {/* Movies List */}
      {renderMovieList()}
    </div>
  );
};

export default Sidebar;

const TabButton = ({
  title,
  activeTab,
  tabType,
  onClick,
}: {
  title: string;
  activeTab: TabType;
  tabType: TabType;
  onClick: (tabType: TabType) => void;
}) => {
  return (
    <button
      className={`px-1 border-b-4 ${
        tabType === activeTab ? "border-primary" : "border-background"
      }`}
      onClick={() => onClick(tabType)}
    >
      {title}
    </button>
  );
};

const MovieList = ({ movies }: { movies: Movie[] }) => {
  return (
    <div className="space-y-2">
      {movies.length > 0 ? (
        movies.map((movie) => (
          <Link
            key={movie._id}
            href={`/phim/${movie.slug}`}
            className="space-y-2 group grid grid-cols-3 gap-3 items-center"
          >
            <div className="col-span-1 relative aspect-[3/4] rounded-lg overflow-hidden">
              <Image
                src={`${apiConfig.IMG_URL}${movie.thumb_url}`}
                alt={movie.origin_name}
                fill
                sizes="(max-width: 1280px) 30vw, 20vw"
                placeholder="blur"
                blurDataURL="/blur_img.webp"
                className="absolute inset-0 size-full object-cover group-hover:scale-110 transition duration-500 ease-in-out"
              />
              <div className="absolute right-1 top-1 bg-black/80 rounded-lg px-2 py-1 flex items-center gap-1 text-xs text-primary font-semibold">
                <StarIcon className="size-3" />
                {movie.tmdb.vote_average.toFixed(0)}
              </div>
            </div>
            <div className="col-span-2 h-full space-y-3">
              <h3 className="line-clamp-2 group-hover:text-primary group-hover:font-semibold">
                {movie.name}
              </h3>
              <div className="text-xs space-y-2">
                <div className="flex items-center gap-2 overflow-hidden">
                  <Badge>{movie.quality}</Badge>
                  <Badge>
                    {movie.lang} {movie.sub_docquyen && "độc quyền"}
                  </Badge>
                </div>

                <div className="space-x-2 flex items-center">
                  <BorderedItem>{movie.year}</BorderedItem>
                  {movie.chieurap && <BorderedItem>Chiếu rạp</BorderedItem>}
                  {movie.tmdb.season && (
                    <BorderedItem>Phần {movie.tmdb.season}</BorderedItem>
                  )}
                  <BorderedItem>{movie.time}</BorderedItem>
                  <BorderedItem>{movie.episode_current}</BorderedItem>
                </div>
              </div>
            </div>
          </Link>
        ))
      ) : (
        <Loading />
      )}
    </div>
  );
};
