import Loading from "@/components/Loading";

export default function LoadingPage() {
  return (
    // 2. animate-in fade-in giúp trang loading hiện ra mượt mà không bị giật chớp
    <div className="w-full flex-1 min-h-[70vh] flex items-center justify-center gap-6 animate-in fade-in duration-500">
      <Loading />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.webp"
        alt="V-Movie Logo"
        loading="eager"
        className="w-48 sm:w-56"
      />
    </div>
  );
}
