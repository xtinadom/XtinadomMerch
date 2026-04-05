import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "prisma", "@prisma/client", "@prisma/adapter-pg"],
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
