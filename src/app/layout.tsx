import dynamic from "next/dynamic";
import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";

import ReactQueryClientProvider from "@/providers/ReactQueryClientProvider";
import BaseDataContextProvider from "@/providers/BaseDataContextProvider";

import Header from "@/components/Header";
const Footer = dynamic(() => import("@/components/Footer"), { ssr: false });

import { WEB_TITLE, apiConfig } from "@/lib/configs";

const roboto = Roboto({
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: WEB_TITLE,
  description: "Stream movies using the OPhim API",
  manifest: "/manifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="scroll-smooth">
      <head>
        <link rel="preconnect" href={apiConfig.SEARCH_URL} crossOrigin="" />
        <link rel="preconnect" href={apiConfig.IMG_URL} crossOrigin="" />
      </head>
      <body className={`${roboto.className} antialiased`}>
        <ReactQueryClientProvider>
          <BaseDataContextProvider>
            <Header />
            {children}
            <Footer />
          </BaseDataContextProvider>
        </ReactQueryClientProvider>
      </body>
    </html>
  );
}
