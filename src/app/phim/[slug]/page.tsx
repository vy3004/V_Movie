import { fetchDetailMovie } from "@/lib/apiClient";

export default async function MoviePage({
  params,
}: {
  params: { slug: string };
}) {
  const data = await fetchDetailMovie({ slug: params.slug });

  console.log(data);

  return <div className="h-screen">Page</div>;
}
