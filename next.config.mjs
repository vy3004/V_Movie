/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.ophim.live",
      },
    ],
  },
};

export default nextConfig;