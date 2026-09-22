/**
 * Resolves the albums of `albums.ts` against the iTunes Search API and
 * writes their artwork URL, their genre and their track listing, with
 * the previews, into `album-details.json`.
 *
 *   npm run album-data
 *
 * This script replaced a pipeline of MusicBrainz and the Cover Art
 * Archive, for three reasons. It uses one API with no authentication in
 * place of two. Its artwork URL has a size template and is CORS-open,
 * thus the repo holds no image. And, the most important reason, each
 * track has a 30-second `previewUrl` that is also CORS-open. Thus the
 * player can play audio and the visualizer can read a real spectrum. To
 * pair audio with a track listing across two catalogues by title is
 * fragile, and that fragility put an incorrect sleeve on Hybrid Theory.
 *
 * This is the iTunes Search API and not the Apple Music API. The Apple
 * Music API returns more data, such as `previews` and `artwork` with an
 * extracted `bgColor` and `textColor` palette. But it needs a developer
 * token signed with a MusicKit private key, thus it is not usable with
 * no authentication.
 *
 * A second run is cheap. An album with an `appleId` does not search, and
 * the script does not change an album that is already in the details
 * file. `--force` fetches again, and `--resolve` runs the search again
 * also for an album that has an id.
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ALBUMS, albumSearchTitle, type Album } from "../app/blade-dashboard-mockups/_components/albums.ts";

/** Apple needs no key, but it limits the rate. Near 20 calls a minute is safe. */
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

/** Removes the case, the punctuation and the accents, thus two catalogue titles compare as equal. */
const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Editions that are not the album, also when the name matches well. The
 * script keeps "(Remastered)" and "(2019 Mix)": for some records, such
 * as Abbey Road, the store has no edition without a suffix.
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
  // The endpoint answers as text/javascript, thus `response.json()` is
  // not reliable. Parse the body here.
  return JSON.parse(await response.text()) as T;
}

/**
 * The store collection of an album, or null.
 *
 * The search ranks an edition above the original. "Abbey Road (2019
 * Mix)" and "(Super Deluxe Edition)" both rank above the album, and a
 * search for a title alone also returns tribute records by other
 * artists. Thus the filter is structural: the artist must match, the
 * collection name must start with the title of the album, and the
 * script rejects the clear non-albums. Of the results that stay, an
 * exact name match wins. If there is none, the result with the fewest
 * tracks wins, which selects the album and not a deluxe edition with a
 * bonus disc.
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
  /** The URL of the 100 px artwork. The app changes the size segment (`album-details.ts`). */
  artworkUrl100: string | null;
  tracks: { title: string; ms: number | null; previewUrl: string | null }[];
}

/**
 * All the data of one album, from one lookup.
 *
 * `lookup?entity=song` returns the collection as its first result and
 * the tracks after it. Thus the name, the artist, the genre and the
 * artwork of the album arrive in the same request as the listing. This
 * is important for an album whose id a person set by hand from a
 * `music.apple.com` URL: such an album does not use the search, thus
 * this request is the only source of its metadata. A set id is also the
 * better method, because it names the exact edition and does not depend
 * on the rank of a search result.
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
    // This is the first run.
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
        // Use the metadata of the store and not the local data: it
        // names the edition and formats the genre as Apple does.
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

  // The script removes each entry that nothing references, thus a
  // corrected id cannot leave an old listing in the file.
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
