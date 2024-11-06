/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { PlayIcon, PlusIcon, StarIcon } from "@heroicons/react/24/solid";

import { apiConfig } from "@/lib/configs";
import { Movie } from "@/lib/types";

interface MovieDetailProps {
  movie: Movie;
}

const MovieDetail = ({ movie }: MovieDetailProps) => {
  return (
    <div className="grid grid-cols-3 gap-4">
      <img
        alt={movie.origin_name}
        src={`${apiConfig.IMG_URL}${movie.thumb_url}&w=400`}
        srcSet={`
          ${apiConfig.IMG_URL}${movie.thumb_url}&w=400 400w, 
        ${apiConfig.IMG_URL}${movie.poster_url}&w=640 640w
      `}
        sizes="(min-width: 640px) 400px, 640px"
        loading="eager"
        className="object-cover col-span-3 sm:col-span-1 rounded-lg"
      />

      <MovieInfo
        className="col-span-3 sm:col-span-2"
        movie={movie}
        isDetail={true}
      />
    </div>
  );
};

export default MovieDetail;

export const Badge = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) =>
  children && (
    <div className={`px-2 py-1 rounded bg-primary flex-none ${className}`}>
      {children}
    </div>
  );

export const BorderedItem = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) =>
  children && (
    <span className={`border-r-2 pr-2 last:border-0 line-clamp-1 ${className}`}>
      {children}
    </span>
  );

export const MovieInfo = ({
  movie,
  className = "",
  isDetail,
}: {
  movie: Movie;
  className?: string;
  isDetail: boolean;
}) => (
  <div className={className}>
    <h1 className="text-xl font-extrabold text-primary line-clamp-1 md:leading-tight sm:text-3xl md:text-5xl">
      {movie.name}
    </h1>
    <h2 className="text-sm line-clamp-1 sm:text-xl md:text-3xl">
      {movie.origin_name}
    </h2>
    <div className="space-y-1 sm:space-y-4 text-xs md:text-sm pt-4 md:pt-8">
      <MovieTags movie={movie} className="space-y-2 sm:space-y-4" />

      <CategoryAndCountry
        movie={movie}
        className={isDetail ? "flex-wrap" : "overflow-hidden"}
      />

      {isDetail && (
        <div className="space-y-1 py-2">
          {movie.director.length > 0 && movie.director[0] !== "" && (
            <div>
              <span className="text-gray-400">Đạo diễn:</span>{" "}
              {movie.director.map((d) => d).join(", ")}
            </div>
          )}

          {movie.actor?.length > 0 && movie.actor[0] && (
            <div>
              <span className="text-gray-400">Diễn viên:</span>{" "}
              {movie.actor.map((a) => a).join(", ")}
            </div>
          )}

          {movie.content && movie.content.trim() !== "" && (
            <div>
              <span className="text-gray-400">Mô tả:</span>
              <div dangerouslySetInnerHTML={{ __html: movie.content }} />
            </div>
          )}
        </div>
      )}
    </div>
  </div>
);

export const MovieTags = ({
  movie,
  className = "",
}: {
  movie: Movie;
  className?: string;
}) => (
  <div className={className}>
    <div className="flex items-center gap-2 overflow-hidden">
      {movie.tmdb.type && (
        <Badge className="uppercase">{movie.tmdb.type}</Badge>
      )}
      <Badge>{movie.quality}</Badge>
      <Badge>
        {movie.lang} {movie.sub_docquyen && "độc quyền"}
      </Badge>
    </div>

    <div className="space-x-2 flex items-center">
      <BorderedItem className="text-primary font-semibold flex items-center">
        <StarIcon className="mr-1 size-4" />{" "}
        {movie.tmdb.vote_average.toFixed(0)}
      </BorderedItem>

      <BorderedItem>{movie.year}</BorderedItem>
      {movie.chieurap && <BorderedItem>Chiếu rạp</BorderedItem>}
      {movie.tmdb.season && (
        <BorderedItem>Phần {movie.tmdb.season}</BorderedItem>
      )}
      <BorderedItem>{movie.time}</BorderedItem>
      <BorderedItem>{movie.episode_current}</BorderedItem>
    </div>
  </div>
);

const CategoryAndCountry = ({
  movie,
  className = "",
}: {
  movie: Movie;
  className?: string;
}) => (
  <div className={`flex items-center gap-2 ${className}`}>
    {movie.country.map((ctr) => (
      <Badge className="bg-white/40" key={ctr.slug}>
        {ctr.name}
      </Badge>
    ))}
    {movie.category.map((cate) => (
      <Badge className="bg-white/40" key={cate.slug}>
        {cate.name}
      </Badge>
    ))}
  </div>
);

export const ActionButtons = ({
  movie,
  className = "",
}: {
  movie: Movie;
  className?: string;
}) => {
  const hrefWatchMovie =
    movie.episodes && movie.episodes[0]
      ? `/phim/${movie.slug}?tap=${movie.episodes[0].server_data[0].slug}#video`
      : `/phim/${movie.slug}`;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Link
        aria-label="Xem phim"
        href={hrefWatchMovie}
        className="flex items-center font-bold bg-primary hover:bg-main rounded px-4 py-3"
      >
        <PlayIcon className="size-4 md:size-8" />
        <span className="hidden md:block">Xem Phim</span>
      </Link>
      <button aria-label="Lưu phim" className="bg-foreground rounded p-3">
        <PlusIcon className="size-4 md:size-8 text-background" />
      </button>
    </div>
  );
};
