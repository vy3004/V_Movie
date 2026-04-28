import Loading from "@/components/ui/Loading";
import Logo from "@/components/ui/Logo";

export default function LoadingPage() {
  return (
    <div className="h-screen col-span-12 xl:col-span-8 flex items-center justify-center gap-2">
      <Loading />
      <Logo className="w-56" />
    </div>
  );
}
