import type { NextConfig } from "next";

const securityHeaders: { key: string; value: string }[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "pg",
    "pgpass",
    "pg-connection-string",
    "pg-pool",
    "pg-protocol",
    "pg-types",
    "prisma",
    "@prisma/client",
    "@prisma/adapter-pg",
  ],
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
      { source: "/shop/sub", destination: "/shop/all", permanent: true },
      { source: "/shop/sub/tag/:slug", destination: "/shop/tag/:slug", permanent: true },
      { source: "/shop/domme", destination: "/shop/all", permanent: true },
      { source: "/shop/domme/tag/:slug", destination: "/shop/tag/:slug", permanent: true },
      { source: "/s/:shopSlug/sub", destination: "/s/:shopSlug/all", permanent: true },
      { source: "/s/:shopSlug/sub/tag/:slug", destination: "/s/:shopSlug/tag/:slug", permanent: true },
      { source: "/s/:shopSlug/domme", destination: "/s/:shopSlug/all", permanent: true },
      { source: "/s/:shopSlug/domme/tag/:slug", destination: "/s/:shopSlug/tag/:slug", permanent: true },
      { source: "/collection/sub", destination: "/shop/all", permanent: true },
      { source: "/collection/domme", destination: "/shop/all", permanent: true },
      { source: "/category/domme", destination: "/shop/tag/mug", permanent: true },
      { source: "/category/domme-mugs", destination: "/shop/tag/mug", permanent: true },
      { source: "/category/domme-tees", destination: "/shop/tag/t-shirt", permanent: true },
      {
        source: "/category/domme-website-services",
        destination: "/shop/all",
        permanent: true,
      },
      { source: "/category/photo-printed", destination: "/shop/all", permanent: true },
      { source: "/category/photo-printed-mugs", destination: "/shop/tag/mug", permanent: true },
      {
        source: "/category/photo-printed-canvas",
        destination: "/shop/tag/canvas-print",
        permanent: true,
      },
      { source: "/category/used", destination: "/shop/all", permanent: true },
    ];
  },
};

export default nextConfig;
