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
    ],
    background_color: "#0a0a0a",
    theme_color: "#cc223c",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
  };
}
