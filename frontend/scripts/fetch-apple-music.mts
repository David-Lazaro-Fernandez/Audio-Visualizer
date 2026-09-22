/**
 * Resolves the albums in `albums.ts` against the **iTunes Search API** and
 * writes their artwork URL, genre and track listing - previews included -
 * into `album-details.json`.
 *
 *   npm run album-data
 *
 * This replaced a MusicBrainz + Cover Art Archive pipeline, for three
 * reasons. It is one unauthenticated API instead of two. Its artwork URL
 * is size-templated and CORS-open, so nothing has to be checked into the
 * repo. And, the reason that matters: each track comes with a 30-second
 * `previewUrl` that is *also* CORS-open, so the player can actually play
 * something and the visualizer can read a real spectrum. Crossing two
 * catalogues by title to pair audio with a track listing would have been
 * exactly the fragility that put a bootleg sleeve on Hybrid Theory.
 *
 * Note this is the iTunes Search API, not the Apple Music API. The latter
 * returns a richer payload - `previews`, `artwork` with an extracted
 * `bgColor`/`textColor` palette - but needs a developer token signed with
 * a MusicKit private key, so it is not usable unauthenticated.
 *
 * Re-running is cheap: an album with an `appleId` skips the search, and an
 * album already in the details file is left alone. `--force` refetches,
 * `--resolve` re-runs the search even for albums that have an id.
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ALBUMS, albumSearchTitle, type Album } from "../app/blade-dashboard-mockups/_components/albums.ts";

/** Apple asks for no key, but it does rate limit; ~20 calls/min is safe. */
const INTERVAL_MS = 900;

const DETAILS_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "app",
  "blade-dashboard-mockups",
  "_components",
  "album-details.json",
);

const force = process.argv.includes("--force");
const reresolve = process.argv.includes("--resolve");
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Fold case, punctuation and accents so catalogue titles compare equal. */
const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Editions that are not the album, however well they match its name.
 * "(Remastered)" and "(2019 Mix)" are kept - for some records, Abbey Road
 * among them, no unadorned edition exists on the store at all.
 */
const NOT_THE_ALBUM =
  /\b(remix|remixes|live|karaoke|tribute|instrumental|covers?|commentary)\b/i;

interface Collection {
  collectionId: number;
  collectionName: string;
  artistName: string;
  trackCount?: number;
  releaseDate?: string;
  primaryGenreName?: string;
  artworkUrl100?: string;
}

interface StoreTrack {
  wrapperType?: string;
  trackNumber?: number;
  trackName?: string;
  trackTimeMillis?: number;
  previewUrl?: string;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`iTunes ${response.status} for ${url}`);
  // The endpoint answers as text/javascript, so `response.json()` alone
  // is not guaranteed; parse the body ourselves.
  return JSON.parse(await response.text()) as T;
}

/**
 * The store collection for an album, or null.
 *
 * Search ranks editions ahead of originals - "Abbey Road (2019 Mix)" and
 * "(Super Deluxe Edition)" both outrank the album, and a search for a
 * title alone pulls in tribute records by other artists entirely. So the
 * filter is structural: the artist has to match, the collection name has
 * to *begin* with the album's title, and the obvious non-albums are
 * rejected outright. Of what survives, an exact name match wins;
 * otherwise the fewest tracks does, which picks the album over a deluxe
 * edition padded with a bonus disc.
 */
async function resolveCollection(album: Album): Promise<Collection | null> {
  const title = albumSearchTitle(album);
  const term = encodeURIComponent(`${title} ${album.artist}`);
  const body = await getJson<{ results: Collection[] }>(
    `https://itunes.apple.com/search?term=${term}&entity=album&limit=25`,
  );

  const wantedTitle = normalize(title);
  const wantedArtist = normalize(album.artist ?? "");
  const candidates = body.results.filter(
    (entry) =>
      normalize(entry.artistName) === wantedArtist &&
      normalize(entry.collectionName).startsWith(wantedTitle) &&
      !NOT_THE_ALBUM.test(entry.collectionName),
  );
  if (candidates.length === 0) return null;

  const exact = candidates.filter(
    (entry) => normalize(entry.collectionName) === wantedTitle,
  );
  const pool = exact.length > 0 ? exact : candidates;
  return [...pool].sort((a, b) => (a.trackCount ?? 999) - (b.trackCount ?? 999))[0];
}

interface AlbumDetails {
  appleId: number;
  title: string;
  artist: string;
  genre: string | null;
  /** The 100 px URL; the app rewrites the size segment (`album-details.ts`). */
  artworkUrl100: string | null;
  tracks: { title: string; ms: number | null; previewUrl: string | null }[];
}

/**
 * Everything about one album, from a single lookup.
 *
 * `lookup?entity=song` returns the collection as its first result and the
 * tracks after it, so the album's name, artist, genre and artwork arrive
 * in the same request as its listing. That matters for albums whose id
 * was pinned by hand from a `music.apple.com` URL: those never go through
 * the search, so this is the only place their metadata can come from -
 * and pinning is the better path anyway, since it names the exact edition
 * instead of trusting a search to rank it first.
 */
async function fetchAlbum(appleId: number) {
  const body = await getJson<{ results: (Collection & StoreTrack)[] }>(
    `https://itunes.apple.com/lookup?id=${appleId}&entity=song&limit=200`,
  );
  const collection = body.results.find(
    (entry) => entry.wrapperType === "collection",
  );
  const tracks = body.results
    .filter((entry) => entry.wrapperType === "track" && entry.trackName)
    .sort((a, b) => (a.trackNumber ?? 0) - (b.trackNumber ?? 0))
    .map((entry) => ({
      title: entry.trackName!,
      ms: entry.trackTimeMillis ?? null,
      previewUrl: entry.previewUrl ?? null,
    }));
  return { collection, tracks };
}

async function main() {
  let details: Record<string, AlbumDetails> = {};
  try {
    details = JSON.parse(await readFile(DETAILS_FILE, "utf8"));
  } catch {
    // First run.
  }

  const resolved: { title: string; appleId: number }[] = [];
  let called = false;
  let changed = false;

  for (const album of ALBUMS) {
    if (!album.artist) {
      console.log(`  --   ${album.title}  (no artist, placeholder by design)`);
      continue;
    }

    let appleId = album.appleId;
    let matched = "";
    if (!appleId || reresolve) {
      if (called) await sleep(INTERVAL_MS);
      called = true;
      const collection = await resolveCollection(album);
      if (!collection) {
        console.log(`  ??   ${album.title}  (no confident store match)`);
        continue;
      }
      if (album.appleId && collection.collectionId !== album.appleId) {
        console.log(`  !=   ${album.title}  pinned ${album.appleId} -> ${collection.collectionId}`);
      }
      appleId = collection.collectionId;
      matched = ` -> "${collection.collectionName}"`;
      resolved.push({ title: album.title, appleId });
    }

    const entry = details[appleId];
    if (force || !entry || entry.tracks.length === 0) {
      if (called) await sleep(INTERVAL_MS);
      called = true;
      try {
        const { collection, tracks } = await fetchAlbum(appleId);
        // The store's own metadata rather than ours: it names the edition
        // and formats the genre the way Apple does.
        details[appleId] = {
          appleId,
          title: collection?.collectionName ?? album.title,
          artist: collection?.artistName ?? album.artist ?? "",
          genre: collection?.primaryGenreName ?? null,
          artworkUrl100: collection?.artworkUrl100 ?? null,
          tracks,
        };
        changed = true;
      } catch (error) {
        console.log(`  xx   ${album.title}  ${(error as Error).message}`);
        continue;
      }
    }

    const final = details[appleId];
    const withAudio = final.tracks.filter((track) => track.previewUrl).length;
    console.log(
      `  ok   ${album.title}  ${final.tracks.length} tracks, ${withAudio} playable, ` +
        `${final.genre ?? "no genre"}  ${appleId}${matched}`,
    );
  }

  // Anything no longer referenced is dropped, so a corrected id cannot
  // leave a stale listing behind.
  const wanted = new Set(ALBUMS.map((album) => album.appleId).filter(Boolean));
  for (const key of Object.keys(details)) {
    if (wanted.has(Number(key)) || resolved.some((r) => String(r.appleId) === key)) continue;
    delete details[key];
    changed = true;
    console.log(`  rm   orphaned details ${key}`);
  }

  if (changed) {
    const sorted = Object.fromEntries(Object.keys(details).sort().map((k) => [k, details[k]]));
    await writeFile(DETAILS_FILE, JSON.stringify(sorted, null, 2) + "\n");
    console.log(`\nWrote details for ${Object.keys(sorted).length} albums.`);
  }

  if (resolved.length) {
    console.log("\nPaste these into albums.ts so future runs skip the search:\n");
    for (const { title, appleId } of resolved) {
      console.log(`  ${JSON.stringify(title)}: ${appleId},`);
    }
  }
}

await main();
