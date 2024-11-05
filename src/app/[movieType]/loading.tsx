/* eslint-disable @next/next/no-img-element */

import Loading from "@/components/Loading";

export default function LoadingPage() {
  return (
    <div className="h-screen col-span-12 xl:col-span-8 flex items-center justify-center gap-2">
      <Loading />
      <img className="w-56" src="/logo.webp" alt="Logo" loading="lazy" />
    </div>
  );
}
