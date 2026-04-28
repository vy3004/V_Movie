import dynamic from "next/dynamic";
import Header from "@/components/layout/Header";

const Footer = dynamic(() => import("@/components/layout/Footer"), {
  ssr: false,
  loading: () => <div className="h-20 w-full bg-zinc-950" />,
});

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">{children}</main>
      <Footer />
    </div>
  );
}
