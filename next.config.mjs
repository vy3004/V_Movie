/** @type {import('next').NextConfig} */
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  buildExcludes: [/middleware-manifest\.json$/, /_next\/static\/.*\.rsc$/],
  publicExcludes: ["!manifest.webmanifest"],
  cacheOnFrontEndNav: true,
  runtimeCaching: [
    {
      // Cache Poster Phim (Nguồn từ Proxy wsrv.nl)
      urlPattern: /^https:\/\/wsrv\.nl\/.*\.(png|jpg|jpeg|svg|webp)$/,
      handler: "CacheFirst",
      options: {
        cacheName: "movie-posters",
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 30 * 24 * 60 * 60, // Giữ 30 ngày vì poster ít thay đổi
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    {
      // Cache các dữ liệu ít thay đổi (Thể loại, Quốc gia)
      urlPattern: /^https:\/\/ophim1\.com\/v1\/api\/(the-loai|quoc-gia)$/,
      handler: "StaleWhileRevalidate", // Dùng dữ liệu cũ trong lúc tải dữ liệu mới ngầm
      options: {
        cacheName: "api-static-data",
        expiration: {
          maxEntries: 20,
          maxAgeSeconds: 7 * 24 * 60 * 60,
        },
      },
    },
    {
      // Tối ưu cho Google Fonts
      urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "google-fonts",
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 365 * 24 * 60 * 60,
        },
      },
    },
  ],
});

const nextConfig = {
  reactStrictMode: true,
  images: {
    minimumCacheTTL: 60,
    remotePatterns: [
      { protocol: "https", hostname: "wsrv.nl" },
      { protocol: "https", hostname: "img.ophim.live" },
    ],
  },
};

export default withPWA(nextConfig);
