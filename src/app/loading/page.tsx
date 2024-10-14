import Loading from "@/components/Loading";
import Image from "next/image";

export default function LoadingPage() {
  return (
    <div className="h-screen border flex items-center justify-center gap-2">
      <Loading />
      <Image
        className="w-56"
        src="/logo.png"
        alt="Logo"
        width={224}
        height={66}
      />
    </div>
  );
}
