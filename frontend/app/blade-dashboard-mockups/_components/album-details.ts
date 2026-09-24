/**
 * The fetched data of an album: its artwork, its genre and its track
 * listing (DESIGN.md §6.12, §6.14, §6.15, §6.16).
 *
 * This file is separate from `albums.ts`, which divides the data that a
 * person maintains from the data that a script generates. `albums.ts` is
 * the list that a person edits, and `scripts/fetch-apple-music.mts`
 * imports it. Thus `albums.ts` must not import the JSON that the same
 * script writes.
 *
 * All the data here comes from the iTunes Search API. The CDN of Apple
 * serves the artwork and the previews with
 * `Access-Control-Allow-Origin: *`, thus they are links and are not
 * checked in. The artwork goes through `next/image` (refer to
 * `remotePatterns` in `next.config.ts`). A Web Audio `AnalyserNode` can
 * read the preview, thus the visualizer shows a real spectrum and not a
 * synthetic one (§6.16).
 */

import ALBUM_DETAILS from "./album-details.json";
import { ALBUMS, type Album } from "./albums";

/** One track, as the store gives it. */
export interface Track {
  title: string;
  /** The length in ms. It is null when the store has no duration. */
  ms: number | null;
  /** A 30-second AAC preview, served CORS-open. It is null when the store has none. */
  previewUrl: string | null;
}

interface AlbumDetails {
  appleId: number;
  /** The name of the edition. It can have a suffix such as "(2019 Mix)". */
  title: string;
  artist: string;
  genre: string | null;
  /** The URL of the 100 px artwork. `albumArtworkUrl` changes the size segment. */
  artworkUrl100: string | null;
  tracks: Track[];
}

const DETAILS = ALBUM_DETAILS as Record<string, AlbumDetails>;

function detailsFor(album: Album): AlbumDetails | undefined {
  return album.appleId ? DETAILS[String(album.appleId)] : undefined;
}

/** Shared, thus an album with no listing returns the same reference each time. */
const NO_TRACKS: Track[] = [];

export function albumTracks(album: Album): Track[] {
  return detailsFor(album)?.tracks ?? NO_TRACKS;
}

/**
 * The artwork at the given size.
 *
 * An artwork URL of Apple ends with a `{w}x{h}bb.jpg` segment, and the
 * CDN resizes the image on demand. Thus one stored URL serves each size
 * that the UI needs, from 24 px in a browse row to some hundreds of
 * pixels in a player. A change to the segment is the documented method.
 * There is no separate endpoint.
 */
export function albumArtworkUrl(album: Album, size: number): string | null {
  const url = detailsFor(album)?.artworkUrl100;
  return url ? url.replace(/100x100bb/, `${size}x${size}bb`) : null;
}

/** The genre of the album from the store. Apple gives it in title case. */
export function albumGenre(album: Album): string | null {
  return detailsFor(album)?.genre ?? null;
}

/**
 * The length as "4:14", as the console shows it. The result is empty
 * when the length is unknown, thus the row does not show its meta column
 * and does not print a placeholder.
 */
export function formatTrackLength(ms: number | null): string {
  if (ms === null) return "";
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * The title of the album screen: the album, then its artist in
 * parentheses (§6.14). The console showed the record label there, but no
 * music file carries a label. The artist is the field that a library
 * has, and it is the field that a user wants to read from a couch.
 */
export function albumHeading(album: Album): string {
  return album.artist ? `${album.title} (${album.artist})` : album.title;
}

/**
 * An artist or a genre, with the albums of the library that sit under
 * it (DESIGN.md §6.12, §6.21).
 *
 * One interface serves both, because an artist and a genre are the same
 * fact here: a name, and the albums it gathers. Thus the screen that
 * lists them is one component and not two.
 *
 * The albums are the albums of **this library** and not the catalogue
 * of the store. Apple has an artist endpoint that returns a full
 * discography, and that is the wrong set: the browse list of the
 * console showed the records that the gamer had. Grouping `ALBUMS` is
 * also free, needs no second request and no key, and cannot disagree
 * with the album list that the same screen shows.
 */
export interface AlbumGroup {
  name: string;
  albums: Album[];
}

/**
 * The placeholders of the console. Both fields are optional, thus an
 * album that the store does not resolve still reaches a group instead
 * of disappearing from the browse screen.
 */
const UNKNOWN_ARTIST = "Unknown Artist";
const UNKNOWN_GENRE = "Unknown Genre";

/**
 * The albums, gathered by one of their fields.
 *
 * The groups are in the collation of the album list itself, which
 * orders by letter and ignores case, thus "Belanova" precedes
 * "BROCKHAMPTON". The locale is fixed, because the groups are built at
 * module scope and are rendered on the server and on the client: a
 * default that differs between the two would be a hydration mismatch.
 *
 * Inside a group the albums keep the order of `ALBUMS`, which is
 * already by title.
 */
function groupAlbums(keyOf: (album: Album) => string): AlbumGroup[] {
  const groups = new Map<string, Album[]>();
  for (const album of ALBUMS) {
    const key = keyOf(album);
    const albums = groups.get(key);
    if (albums) albums.push(album);
    else groups.set(key, [album]);
  }
  return [...groups]
    .map(([name, albums]) => ({ name, albums }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
}

/**
 * The Artists and the Genres categories of the browse screen (§6.12).
 *
 * Neither list is written by hand. The artist is the field that a
 * person maintains in `albums.ts`, which is the one that the album
 * screen prints in its heading (§6.14), and the genre arrives with the
 * payload of the store beside the artwork and the track listing. A
 * hand-written list of names would be a third copy of facts that the
 * data already carries, and it would go stale the moment an album is
 * added.
 */
export const ARTISTS: AlbumGroup[] = groupAlbums(
  (album) => album.artist ?? UNKNOWN_ARTIST,
);

export const GENRES: AlbumGroup[] = groupAlbums(
  (album) => albumGenre(album) ?? UNKNOWN_GENRE,
);
