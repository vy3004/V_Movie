import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "V · Movie",
    short_name: "V · Movie",
    description: "Stream movies using the OPhim API",
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/favicon.ico",
        sizes: "256x256",
        type: "image/x-icon",
      },
    ],
    background_color: "#111319",
    theme_color: "#0a0a0a",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
  };
}
