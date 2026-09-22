import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        // The album artwork from the iTunes Search API. The hosts are
        // is1-ssl.mzstatic.com to is5-ssl.mzstatic.com, and the path
        // holds the size. Thus the pathname must stay open, because
        // `album-details.ts` changes it.
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
