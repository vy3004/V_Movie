import dynamic from "next/dynamic";
import Script from "next/script"; 
import type { Metadata, Viewport } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";

import ReactQueryClientProvider from "@/providers/ReactQueryClientProvider";
import BaseDataContextProvider from "@/providers/BaseDataContextProvider";
import AuthModalProvider from "@/providers/AuthModalProvider";

import Header from "@/components/Header";
const Footer = dynamic(() => import("@/components/Footer"), {
  ssr: false,
  loading: () => <div className="h-20 w-full bg-zinc-950" />, // Tránh nhảy layout khi Footer load
});
import AuthModal from "@/components/AuthModal";
import AuthWatcher from "@/components/AuthWatcher";

import { WEB_TITLE, apiConfig } from "@/lib/configs";

const roboto = Roboto({
  weight: ["400", "500", "700"],
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-roboto", // Dùng biến CSS để đồng bộ Tailwind
});

export const metadata: Metadata = {
  title: {
    default: WEB_TITLE,
    template: `%s | ${WEB_TITLE}`,
  },
  description:
    "Nền tảng xem phim chất lượng cao, cập nhật nhanh chóng các bộ phim mới nhất, phim bộ, phim lẻ và anime vietsub.",
  manifest: "/manifest",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ),
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#e50914",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="scroll-smooth">
      <head>
        <link
          rel="preconnect"
          href={process.env.NEXT_PUBLIC_SUPABASE_URL}
          crossOrigin="anonymous"
        />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />

        {/* Các API và Image server của OPhim */}
        <link
          rel="preconnect"
          href={apiConfig.SEARCH_URL}
          crossOrigin="anonymous"
        />
        <link
          rel="preconnect"
          href={apiConfig.IMG_URL}
          crossOrigin="anonymous"
        />
        <link rel="dns-prefetch" href={apiConfig.IMG_URL} />
      </head>
      <body
        className={`${roboto.className} antialiased bg-black text-white selection:bg-red-600/30`}
      >
        <ReactQueryClientProvider>
          <BaseDataContextProvider>
            <AuthModalProvider>
              <div className="flex flex-col min-h-screen">
                <Header />
                {/* min-h-screen giúp tránh hiện tượng "footer nhảy lên trên" khi chưa có nội dung */}
                <main className="flex-grow">{children}</main>
                <Footer />
              </div>
              <AuthModal />
              <AuthWatcher />
            </AuthModalProvider>
          </BaseDataContextProvider>
        </ReactQueryClientProvider>
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="beforeInteractive"
        />
      </body>
    </html>
  );
}
