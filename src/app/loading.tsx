import Image from "next/image";

import Loading from "@/components/Loading";

export default function LoadingPage() {
  return (
    <div className="h-screen flex items-center justify-center gap-2">
      <Loading />
      <Image
        className="w-56"
        src="/logo.webp"
        alt="Logo"
        width={224}
        height={66}
      />
    </div>
  );
}
