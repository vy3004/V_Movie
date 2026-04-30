import dynamic from "next/dynamic";
import MovieSectionSkeleton from "@/components/shared/MovieSectionSkeleton";
import { MovieService } from "@/services/movie.service";

const MovieSection = dynamic(() => import("@/components/shared/MovieSection"), {
  ssr: false,
  loading: () => <MovieSectionSkeleton />,
});

interface Props {
  title: string;
  slug: string;
}

export default async function ServerMovieSection({ title, slug }: Props) {
  const data = await MovieService.getList({ slug, limit: 12 });

  if (!data?.items || data.items.length === 0) return null;

  return <MovieSection title={title} movies={data.items} hrefViewMore={slug} />;
}
