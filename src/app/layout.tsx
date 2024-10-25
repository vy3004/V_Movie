import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";

import ReactQueryClientProvider from "@/providers/ReactQueryClientProvider";
import BaseDataContextProvider from "@/providers/BaseDataContextProvider";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

import { WEB_TITLE } from "@/lib/configs";

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
