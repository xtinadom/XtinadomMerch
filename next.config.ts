import type { NextConfig } from "next";

const securityHeaders: { key: string; value: string }[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "prisma", "@prisma/client", "@prisma/adapter-pg"],
  async headers() {
    const headers = [...securityHeaders];
    if (process.env.VERCEL_ENV === "production") {
      headers.unshift(
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
        {
          key: "Content-Security-Policy",
          value: "upgrade-insecure-requests",
        },
      );
    }
    return [{ source: "/:path*", headers }];
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
