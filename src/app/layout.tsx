import dynamic from "next/dynamic";
import type { Metadata, Viewport } from "next";
import { Roboto } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

import ReactQueryClientProvider from "@/providers/ReactQueryClientProvider";
import BaseDataContextProvider from "@/providers/BaseDataContextProvider";
import AuthModalProvider from "@/providers/AuthModalProvider";
import NotificationProvider from "@/providers/NotificationProvider";
import ConfirmProvider from "@/providers/ConfirmProvider";

import Header from "@/components/Header";
const Footer = dynamic(() => import("@/components/Footer"), {
  ssr: false,
  loading: () => <div className="h-20 w-full bg-zinc-950" />, // Tránh nhảy layout khi Footer load
});
const AuthModal = dynamic(() => import("@/components/AuthModal"), {
  ssr: false,
});

import { WEB_TITLE, SUPABASE_URL, BASE_MOVIE_API } from "@/lib/configs";

const roboto = Roboto({
  weight: ["400", "500", "700"],
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: {
    default: WEB_TITLE,
    template: `%s | ${WEB_TITLE}`,
  },
  description:
    "Nền tảng xem phim chất lượng cao, cập nhật nhanh chóng các bộ phim mới nhất, phim bộ, phim lẻ và anime vietsub.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_PORT || "http://localhost:3000",
  ),
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/icon-192x192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
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
        <link rel="preconnect" href="https://wsrv.nl" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href={SUPABASE_URL} />
        <link rel="dns-prefetch" href={BASE_MOVIE_API} />
      </head>
      <body
        className={`${roboto.className} antialiased bg-black text-white selection:bg-red-600/30`}
      >
        <ReactQueryClientProvider>
          <BaseDataContextProvider>
            <NotificationProvider>
              <AuthModalProvider>
                <ConfirmProvider>
                  <div className="flex flex-col min-h-screen">
                    <Header />
                    {/* min-h-screen giúp tránh hiện tượng "footer nhảy lên trên" khi chưa có nội dung */}
                    <main className="flex-grow">{children}</main>
                    <Footer />
                  </div>
                  <AuthModal />
                  <Toaster position="bottom-right" richColors />
                </ConfirmProvider>
              </AuthModalProvider>
            </NotificationProvider>
          </BaseDataContextProvider>
        </ReactQueryClientProvider>
      </body>
    </html>
  );
}
