/** @type {import('next').NextConfig} */
import withPWAInit from "@ducanh2912/next-pwa";
import withBundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzerConfig = withBundleAnalyzer({
  enabled: false, // Tắt phân tích bundle để tránh ảnh hưởng đến hiệu suất
});

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  customWorkerDir: "worker",
  buildExcludes: [/middleware-manifest\.json$/, /_next\/static\/.*\.rsc$/],
  publicExcludes: ["!manifest.webmanifest"],
  cacheOnFrontEndNav: true,
  // Dọn dẹp cache cũ khi có version mới
  workboxOptions: {
    cleanupOutdatedCaches: true,
    // Tùy chọn: giới hạn precache entries
    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
  },
  runtimeCaching: [
    {
      // Cache Poster Phim (Nguồn từ Proxy wsrv.nl)
      urlPattern: /^https:\/\/wsrv\.nl\/.*\.(png|jpg|jpeg|svg|webp)$/,
      handler: "CacheFirst",
      options: {
        cacheName: "movie-posters",
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 15 * 24 * 60 * 60,
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
          maxAgeSeconds: 30 * 24 * 60 * 60,
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
  swcMinify: true,
  images: {
    minimumCacheTTL: 60,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      { protocol: "https", hostname: "wsrv.nl" },
      { protocol: "https", hostname: "img.ophim.live" },
    ],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  experimental: {
    optimizePackageImports: ["@heroicons/react", "recharts"],
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
};

// Wrap theo thứ tự: vớiBundleAnalyzerConfig > withPWA > nextConfig
export default withBundleAnalyzerConfig(withPWA(nextConfig));
