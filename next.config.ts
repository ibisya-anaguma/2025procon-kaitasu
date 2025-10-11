import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'shop.aeon.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.aeonnetshop.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
