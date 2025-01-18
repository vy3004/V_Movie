/** @type {import('next').NextConfig} */

import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/wsrv\.nl\/.*\.(png|jpg|jpeg|svg|webp)$/,
      handler: "CacheFirst",
      options: {
        cacheName: "movie-images",
        expiration: {
          maxEntries: 50, // Limit 50 images
          maxAgeSeconds: 7 * 24 * 60 * 60, // Cache 7 days
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
  ],
});

const nextConfig = {
  reactStrictMode: true,
};

export default withPWA(nextConfig);
