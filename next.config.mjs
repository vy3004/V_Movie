/** @type {import('next').NextConfig} */

import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/img\.ophim\.live\/.*\.(png|jpg|jpeg|svg|webp)$/,
      handler: "CacheFirst",
      options: {
        cacheName: "movie-images",
        expiration: {
          maxEntries: 50, // Limit 50 images
          maxAgeSeconds: 30 * 24 * 60 * 60, // Cache 30 days
        },
      },
    },
    {
      urlPattern: /^https:\/\/ophim1\.com\/v1\/api\/(the-loai|quoc-gia)\/.*$/,
      handler: "CacheFirst",
      options: {
        cacheName: "api-static-data",
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 30 * 24 * 60 * 60, // Cache 30 days
        },
      },
    },
    {
      urlPattern:
        /^https:\/\/ophim1\.com\/v1\/api\/danh-sach\/phim-moi-cap-nhat\?sort_field=tmdb\.vote_count$/,
      handler: "NetworkFirst",
      options: {
        cacheName: "api-phim-hot",
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24, // Cache 1 day
        },
      },
    },
  ],
});

const nextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.ophim.live",
        pathname: "**",
      },
    ],
  },
};

export default withPWA(nextConfig);
