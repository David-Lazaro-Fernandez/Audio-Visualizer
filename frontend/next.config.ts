import type { NextConfig } from "next";

/**
 * GitHub Pages serves this site from a sub-path of the domain — the
 * repository name — and cannot run a Node server. The Pages workflow
 * thus sets `NEXT_STATIC_EXPORT` and `NEXT_PUBLIC_BASE_PATH`; both are
 * empty everywhere else, so `next dev` and `next start` keep the full
 * server behaviour and the site still works at the root of a domain.
 *
 * `basePath` must be a build time constant, because Next inlines it
 * into the client bundle.
 */
const isStaticExport = process.env.NEXT_STATIC_EXPORT === "true";
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  // A static export writes `out/`, which is what the Pages artifact
  // holds. Refer to the static-exports guide in the Next docs.
  ...(isStaticExport ? { output: "export" as const } : {}),

  // An empty string is the default; `undefined` keeps it out of the
  // config entirely rather than setting an invalid "".
  basePath: basePath || undefined,

  // `out/page/index.html` rather than `out/page.html`, thus a plain
  // static host resolves a directory URL with no rule of its own.
  trailingSlash: isStaticExport,

  images: {
    // A static export has no image optimizer, thus every image is
    // served as the file it is. This also means `next/image` writes the
    // `src` through unchanged, which is why each one goes through
    // `asset()` (`app/_lib/asset-path.ts`).
    unoptimized: isStaticExport,
    remotePatterns: [
      {
        // The album artwork from the iTunes Search API. The hosts are
        // is1-ssl.mzstatic.com to is5-ssl.mzstatic.com, and the path
        // holds the size. Thus the pathname must stay open, because
        // `album-details.ts` changes it.
        //
        // The optimizer is off in a static export, so this list only
        // guards the server build. The artwork is fetched by the
        // browser straight from Apple either way.
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

  // A rewrite needs a server, and a static export has none — Next lists
  // rewrites as unsupported there. The proxy to the backend is thus
  // only installed when a server is actually running.
  ...(isStaticExport
    ? {}
    : {
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: "http://localhost:4000/api/:path*",
            },
          ];
        },
      }),
};

export default nextConfig;
