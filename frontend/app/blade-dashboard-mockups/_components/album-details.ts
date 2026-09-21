/**
 * The fetched half of an album: its artwork, genre and track listing
 * (DESIGN.md §6.12, §6.14, §6.15, §6.16).
 *
 * Split from `albums.ts` along the line between hand-maintained and
 * generated data. `albums.ts` is the list a person edits, and
 * `scripts/fetch-apple-music.mts` imports it — so it must not, in turn,
 * import the JSON that same script writes.
 *
 * Everything here comes from the iTunes Search API. Artwork and previews
 * are served from Apple's CDN with `Access-Control-Allow-Origin: *`, so
 * they are linked rather than checked in: the artwork goes through
 * `next/image` (see `remotePatterns` in `next.config.ts`) and the preview
 * can be read by a Web Audio `AnalyserNode`, which is what lets the
 * visualizer show a real spectrum instead of a synthetic one (§6.16).
 */

import ALBUM_DETAILS from "./album-details.json";
import type { Album } from "./albums";

/** One track, as the store lists it. */
export interface Track {
  title: string;
  /** Length in ms, or null where the store has no duration on record. */
  ms: number | null;
  /** 30-second AAC preview, CORS-open. Null when the store has none. */
  previewUrl: string | null;
}

interface AlbumDetails {
  appleId: number;
  /** The edition's own name, which may carry a suffix like "(2019 Mix)". */
  title: string;
  artist: string;
  genre: string | null;
  /** The 100 px artwork URL; `albumArtworkUrl` rewrites the size segment. */
  artworkUrl100: string | null;
  tracks: Track[];
}

const DETAILS = ALBUM_DETAILS as Record<string, AlbumDetails>;

function detailsFor(album: Album): AlbumDetails | undefined {
  return album.appleId ? DETAILS[String(album.appleId)] : undefined;
}

/** Shared so an album with no listing returns a stable reference. */
const NO_TRACKS: Track[] = [];

export function albumTracks(album: Album): Track[] {
  return detailsFor(album)?.tracks ?? NO_TRACKS;
}

/**
 * Artwork at the size asked for.
 *
 * Apple's artwork URLs end in a `{w}x{h}bb.jpg` segment that the CDN
 * resizes on demand, so one stored URL serves every size the UI needs —
 * 24 px in a browse row, hundreds in a player. Rewriting the segment is
 * the documented way to do it; there is no separate endpoint.
 */
export function albumArtworkUrl(album: Album, size: number): string | null {
  const url = detailsFor(album)?.artworkUrl100;
  return url ? url.replace(/100x100bb/, `${size}x${size}bb`) : null;
}

/** The store's genre for the album, already title-cased by Apple. */
export function albumGenre(album: Album): string | null {
  return detailsFor(album)?.genre ?? null;
}

/**
 * "4:14", as the console shows it. Empty when the length is unknown, so
 * the row simply omits its meta column rather than printing a placeholder.
 */
export function formatTrackLength(ms: number | null): string {
  if (ms === null) return "";
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * The album screen's title: the album, then its artist in parentheses
 * (§6.14). The console put the record label there, which no music file
 * actually carries — the artist is the field a library really has, and
 * the one worth reading from a couch.
 */
export function albumHeading(album: Album): string {
  return album.artist ? `${album.title} (${album.artist})` : album.title;
}
