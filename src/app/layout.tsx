import dynamic from "next/dynamic";
import type { Metadata, Viewport } from "next";
import { Roboto } from "next/font/google";
import { Toaster } from "sonner";
import NextTopLoader from "nextjs-toploader";
import "./globals.css";

import ReactQueryClientProvider from "@/providers/ReactQueryClientProvider";
import BaseDataContextProvider from "@/providers/BaseDataContextProvider";
import AuthModalProvider from "@/providers/AuthModalProvider";
import NotificationProvider from "@/providers/NotificationProvider";
import ConfirmProvider from "@/providers/ConfirmProvider";
import ScrollToTop from "@/components/layout/ScrollToTop";

const AuthModal = dynamic(() => import("@/components/layout/AuthModal"), {
  ssr: false,
});

import {
  WEB_TITLE,
  SUPABASE_URL,
  BASE_MOVIE_API,
  WSRV_PROXY,
} from "@/lib/configs";

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
        <link rel="preconnect" href={WSRV_PROXY} crossOrigin="anonymous" />
        <link rel="preconnect" href={SUPABASE_URL} crossOrigin="anonymous" />
        <link rel="preconnect" href={BASE_MOVIE_API} crossOrigin="anonymous" />
      </head>
      <body
        className={`${roboto.className} antialiased bg-black text-white selection:bg-red-600/30`}
      >
        <ReactQueryClientProvider>
          <BaseDataContextProvider>
            <NotificationProvider>
              <AuthModalProvider>
                <ConfirmProvider>
                  <NextTopLoader
                    color="#cc223c"
                    showSpinner={false}
                    crawlSpeed={200}
                    height={3}
                  />
                  {children}
                  <AuthModal />
                  <ScrollToTop />
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
