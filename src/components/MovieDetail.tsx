import Link from "next/link";
import Image from "next/image";
import { PlayIcon, PlusIcon, StarIcon } from "@heroicons/react/24/solid";

import { apiConfig } from "@/lib/configs";
import { Movie } from "@/lib/types";

interface MovieDetailProps {
  movie: Movie;
  isWatching: boolean;
}

const MovieDetail = ({ movie }: MovieDetailProps) => {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="relative">
        <Image
          src={`${apiConfig.IMG_URL}${movie.thumb_url}`}
          alt={movie.origin_name}
          width={500}
          height={750}
          placeholder="blur"
          blurDataURL="/blur_img.jpg"
          className="object-cover h-full rounded-lg"
        />
        <ActionButtons
          className="absolute bottom-4 w-full justify-center"
          movie={movie}
        />
      </div>

      <MovieInfo className="col-span-2" movie={movie} isDetail={true} />
    </div>
  );
};

export default MovieDetail;

const Badge = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <span className={`px-2 py-1 rounded bg-primary ${className}`}>
    {children}
  </span>
);

const BorderedItem = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <span className={`border-r-2 pr-2 last:border-0 ${className}`}>
    {children}
  </span>
);

export const MovieInfo = ({
  movie,
  className,
  isDetail,
}: {
  movie: Movie;
  className?: string;
  isDetail: boolean;
}) => (
  <div className={className}>
    <h1 className="text-5xl font-extrabold text-primary line-clamp-1 pb-1">
      {movie.name}
    </h1>
    <h3 className="text-3xl line-clamp-1">{movie.origin_name}</h3>
    <div className="space-y-4 text-sm pt-8">
      <MovieTags movie={movie} className="space-y-4" />

      <CategoryAndCountry movie={movie} />

      {isDetail && (
        <div className="space-y-1">
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
  className,
}: {
  movie: Movie;
  className?: string;
}) => (
  <div className={className}>
    <div className="space-x-2">
      <Badge className="uppercase">{movie.tmdb.type}</Badge>
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

      <span className="border-r-2 pr-2">{movie.year}</span>
      {movie.chieurap && <BorderedItem>Chiếu rạp</BorderedItem>}
      {movie.tmdb.season && (
        <BorderedItem>Phần {movie.tmdb.season}</BorderedItem>
      )}
      <BorderedItem>{movie.time}</BorderedItem>
      <BorderedItem>{movie.episode_current}</BorderedItem>
    </div>
  </div>
);

const CategoryAndCountry = ({ movie }: { movie: Movie }) => (
  <div className="space-x-2">
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
  className,
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
        href={hrefWatchMovie}
        className="flex items-center font-bold bg-primary rounded px-4 py-3"
      >
        <PlayIcon className="size-8" />
        Xem Phim
      </Link>
      <button className="bg-foreground rounded p-3">
        <PlusIcon className="size-8 text-background" />
      </button>
    </div>
  );
};
