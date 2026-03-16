import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Allowing all for now to ensure Supabase and other potential stores work
      },
    ],
  },
};

export default nextConfig;
