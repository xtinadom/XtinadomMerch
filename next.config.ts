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
      { source: "/collection/sub", destination: "/shop/sub", permanent: true },
      { source: "/collection/domme", destination: "/shop/domme", permanent: true },
      { source: "/category/domme", destination: "/shop/domme/tag/mug", permanent: true },
      { source: "/category/domme-mugs", destination: "/shop/domme/tag/mug", permanent: true },
      { source: "/category/domme-tees", destination: "/shop/domme/tag/t-shirt", permanent: true },
      {
        source: "/category/domme-website-services",
        destination: "/shop/domme",
        permanent: true,
      },
      { source: "/category/photo-printed", destination: "/shop/sub", permanent: true },
      { source: "/category/photo-printed-mugs", destination: "/shop/sub/tag/mug", permanent: true },
      {
        source: "/category/photo-printed-canvas",
        destination: "/shop/sub/tag/canvas-print",
        permanent: true,
      },
      { source: "/category/used", destination: "/shop/sub", permanent: true },
    ];
  },
};

export default nextConfig;
