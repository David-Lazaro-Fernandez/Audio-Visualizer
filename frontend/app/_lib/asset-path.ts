/**
 * The prefix for every URL that points at a file in `public/`.
 *
 * On GitHub Pages the site lives at a sub-path of the domain — the
 * repository name — not at its root, so `next.config.ts` sets
 * `basePath`. Next applies that prefix to `next/link`, to the router
 * and to the bundled assets under `/_next`, but **not** to a literal
 * URL that the app writes itself: the `src` of a `next/image`, or the
 * argument of `new Audio()`. The Next docs on `basePath` say so
 * plainly — "you will need to add the basePath in front of src" — and
 * a static export makes it certain, because there is no optimizer
 * endpoint to rewrite the path on the way past.
 *
 * Every reference to a file in `public/` thus goes through `asset()`.
 * The value is inlined at build time, since `basePath` is a build time
 * constant and Next substitutes `NEXT_PUBLIC_*` into the client
 * bundle. It is empty in development and in any deployment at the root
 * of a domain, where `asset()` returns its argument unchanged.
 */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(
  /\/+$/,
  "",
);

/** A URL that already names its own origin or carries its own data. */
const ABSOLUTE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

/**
 * Prefixes a path in `public/` with the base path.
 *
 * A URL that is already absolute is returned unchanged, because one
 * call site carries both kinds: a row's icon is a local file and an
 * album's cover is a remote one from the iTunes Search API (§6.12). So
 * are a `data:` or `blob:` URL, and a path that is prefixed already,
 * thus calling this twice is safe.
 */
export function asset(path: string): string {
  if (!BASE_PATH || !path) return path;
  if (ABSOLUTE.test(path) || !path.startsWith("/")) return path;
  if (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`)) return path;
  return `${BASE_PATH}${path}`;
}
