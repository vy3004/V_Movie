import { notFound } from "next/navigation";
import { fetchDetailMovie, getLatestHistory } from "@/lib/apiClient";
import { createSupabaseServer } from "@/lib/supabase/server";
import BreadCrumb from "@/components/BreadCrumb";
import MovieDetail from "@/components/MovieDetail";
import WatchMovieWithHistory from "@/components/WatchMovieWithHistory";

interface PageProps {
  params: { slug: string };
  searchParams: Record<string, string | undefined>;
}

export async function generateMetadata({ params, searchParams }: PageProps) {
  const data = await fetchDetailMovie({ slug: params.slug });
  if (!data?.item) return {};

  const title = searchParams.tap
    ? `${data.seoOnPage.titleHead} | Tập ${searchParams.tap}`
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
  };
}

export default async function MoviePage({ params, searchParams }: PageProps) {
  const movieDataPromise = fetchDetailMovie({ slug: params.slug });
  const supabase = await createSupabaseServer();
  const userPromise = supabase.auth.getUser();

  const [data, { data: authData }] = await Promise.all([
    movieDataPromise,
    userPromise,
  ]);

  const user = authData?.user;
  const movie = data?.item;
  if (!movie) return notFound();

  // Fetch user preferences for auto_next_episode
  let autoNextEnabled = true; // Default value
  if (user) {
    try {
      const { data: preferences } = await supabase
        .from("user_preferences")
        .select("auto_next_episode")
        .eq("user_id", user.id)
        .single();

      if (preferences) {
        autoNextEnabled = preferences.auto_next_episode ?? true;
      }
    } catch (error) {
      console.error("Error fetching user preferences:", error);
    }
  }

  // Fetch history for the current movie
  const history = user ? await getLatestHistory(user.id, movie.slug) : null;

  return (
    <div className="col-span-12 xl:col-span-8 py-4 space-y-4 sm:space-y-8 animate-in fade-in duration-500">
      <BreadCrumb breadCrumb={data.breadCrumb} />

      <MovieDetail movie={movie} />

      <WatchMovieWithHistory 
        movie={movie} 
        history={history}
        user={user}
        autoNextEnabled={autoNextEnabled}
      />

      {data.seoOnPage.seoSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(data.seoOnPage.seoSchema),
          }}
        />
      )}
    </div>
  );
}
