import { notFound } from "next/navigation";
import BreadCrumb from "@/components/BreadCrumb";
import MovieDetail from "@/components/MovieDetail";
import WatchMovie from "@/components/WatchMovie";
import { fetchDetailMovie, getLatestHistory } from "@/lib/apiClient";
import { createSupabaseServer } from "@/lib/supabase/server";

interface PageProps {
  params: { slug: string };
  searchParams: Record<string, string | undefined>;
}

// Next.js tự động tối ưu: Gọi fetchDetailMovie ở đây và ở MoviePage 
// sẽ chỉ tốn 1 lần request nhờ cơ chế Request Memoization.
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

export default async function MoviePage({ params }: PageProps) {
  // --- TỐI ƯU 1: CHẠY SONG SONG (PARALLEL DATA FETCHING) ---
  // Không await từng cái, mà khởi tạo toàn bộ Promise cùng lúc
  const movieDataPromise = fetchDetailMovie({ slug: params.slug });
  const supabase = await createSupabaseServer();
  const userPromise = supabase.auth.getUser();

  // Đợi phim và user nạp xong đồng thời
  const [data, { data: authData }] = await Promise.all([
    movieDataPromise,
    userPromise,
  ]);

  const user = authData?.user;

  if (!data?.item) return notFound();

  // --- TỐI ƯU 2: FETCH HISTORY NGAY LẬP TỨC NẾU CÓ USER ---
  let history = null;
  if (user) {
    history = await getLatestHistory(user.id, params.slug);
  }

  return (
    <div className="col-span-12 xl:col-span-8 py-4 space-y-4 sm:space-y-8 animate-in fade-in duration-500">
      <BreadCrumb breadCrumb={data.breadCrumb} />

      <MovieDetail movie={data.item} />

      <WatchMovie movie={data.item} history={history} user={user} />
      
      {/* TỐI ƯU 3: JSON-LD SEO (Ghi điểm CV mạnh) */}
      {data.seoOnPage.seoSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data.seoOnPage.seoSchema) }}
        />
      )}
    </div>
  );
}