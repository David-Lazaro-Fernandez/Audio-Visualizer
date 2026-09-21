import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        // Album artwork from the iTunes Search API. Served from is1- to
        // is5-ssl.mzstatic.com, with the size baked into the path, so the
        // pathname has to stay open (`album-details.ts` rewrites it).
        protocol: "https",
        hostname: "*.mzstatic.com",
        pathname: "/image/thumb/**",
      },
    ],
  },
  turbopack: {
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:4000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
