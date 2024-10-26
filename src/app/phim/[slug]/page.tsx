import { notFound } from "next/navigation";

import BreadCrumb from "@/components/BreadCrumb";
import MovieDetail from "@/components/MovieDetail";
import WatchMovie from "@/components/WatchMovie";

import { fetchDetailMovie } from "@/lib/apiClient";

interface PageProps {
  params: { slug: string };
  searchParams: Record<string, string | undefined>;
}

export async function generateMetadata({ params, searchParams }: PageProps) {
  const data = await fetchDetailMovie({ slug: params.slug });

  if (!data?.seoOnPage) return notFound();

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

export default async function MoviePage({ params }: PageProps) {
  const data = await fetchDetailMovie({ slug: params.slug });

  if (!data?.item) return notFound();

  return (
    <div className="col-span-12 xl:col-span-8 py-4 space-y-4 sm:space-y-8">
      <BreadCrumb breadCrumb={data.breadCrumb} />

      <MovieDetail movie={data.item} />

      <WatchMovie movie={data.item} />
    </div>
  );
}
