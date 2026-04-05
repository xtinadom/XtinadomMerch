import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      {
        source: "/category/domme",
        destination: "/category/domme-mugs",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
