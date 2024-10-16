import { redirect } from "next/navigation";

import BreadCrumb from "@/components/BreadCrumb";
import MovieDetail from "@/components/MovieDetail";

import { fetchDetailMovie } from "@/lib/apiClient";
import WatchMovie from "@/components/WatchMovie";

interface PageProps {
  params: { slug: string };
  searchParams: { [key: string]: string | undefined };
}

export async function generateMetadata({ params, searchParams }: PageProps) {
  const data = await fetchDetailMovie({ slug: params.slug });

  if (!data?.seoOnPage) return null;

  const title = searchParams.tap
    ? `${data.seoOnPage.titleHead} | Tập ${searchParams.tap}`
    : data.seoOnPage.titleHead;

  return {
    title: title,
    description: data.seoOnPage.descriptionHead,
    openGraph: {
      title: title,
      description: data.seoOnPage.descriptionHead,
      images: data.seoOnPage.og_image,
      url: data.seoOnPage.og_url,
      type: data.seoOnPage.og_type,
    },
    additionalMetaTags: [
      {
        tagName: "script",
        innerHTML: JSON.stringify(data.seoOnPage.seoSchema),
        type: "application/ld+json",
      },
    ],
  };
}

export default async function MoviePage({ params, searchParams }: PageProps) {
  const data = await fetchDetailMovie({ slug: params.slug });

  if (!data?.item) return null;

  const { tap } = searchParams;

  const isValidEpisode = (value: string) => {
    const episodeNumber = Number(value);

    if (data.item && data.item.episodes[0].server_data[0].slug === "full") {
      return value === "full";
    } else {
      return Number.isInteger(episodeNumber) && episodeNumber > 0;
    }
  };

  if (tap && !isValidEpisode(tap)) redirect(`/phim/${params.slug}`);

  const isWatching = !!tap && isValidEpisode(tap);

  return (
    <div className="py-4 col-span-8 space-y-8">
      <BreadCrumb breadCrumb={data.breadCrumb} />

      <MovieDetail movie={data.item} isWatching={isWatching} />

      {isWatching && <WatchMovie movie={data.item} />}
    </div>
  );
}
