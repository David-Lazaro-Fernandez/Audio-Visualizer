"use client";

/**
 * Resolves an Apple Music link to a playable preview, in the browser.
 *
 * The iTunes Search API needs no key and answers with
 * `Access-Control-Allow-Origin: *`, so this page can look a song up from
 * the client with no route handler in between — unlike the dashboard's
 * albums, which are resolved once by a script and checked in
 * (`scripts/fetch-apple-music.mts`) because a dashboard should not be
 * searching a store at render time. Here the whole point is that you can
 * paste any song, so the lookup has to happen live.
 */

export interface Song {
  id: number;
  title: string;
  artist: string;
  album: string;
  genre: string | null;
  /** 30-second AAC preview, served CORS-open. */
  previewUrl: string;
  /** The 100 px artwork URL; the size segment is rewritable. */
  artworkUrl100: string | null;
}

/**
 * Pulls the track id out of whatever was pasted.
 *
 * A song link ends in the id (`/song/<slug>/<id>`), but a track reached
 * through its album carries the id in `?i=` instead and the path id is
 * the *album's* — so the query parameter has to win, or the page would
 * analyse the wrong thing entirely. A bare number is accepted too.
 */
export function parseSongId(input: string): number | null {
  const text = input.trim();
  if (/^\d+$/.test(text)) return Number(text);
  try {
    const url = new URL(text);
    const fromQuery = url.searchParams.get("i");
    if (fromQuery && /^\d+$/.test(fromQuery)) return Number(fromQuery);
    const last = url.pathname.split("/").filter(Boolean).pop() ?? "";
    return /^\d+$/.test(last) ? Number(last) : null;
  } catch {
    return null;
  }
}

export async function lookupSong(input: string): Promise<Song> {
  const id = parseSongId(input);
  if (id === null) {
    throw new Error("That does not look like an Apple Music song link or id.");
  }

  const response = await fetch(`https://itunes.apple.com/lookup?id=${id}`);
  if (!response.ok) throw new Error(`Lookup failed (${response.status})`);
  // The endpoint answers as text/javascript, so parse the body ourselves.
  const body = JSON.parse(await response.text()) as {
    results?: {
      wrapperType?: string;
      kind?: string;
      trackId?: number;
      trackName?: string;
      artistName?: string;
      collectionName?: string;
      primaryGenreName?: string;
      previewUrl?: string;
      artworkUrl100?: string;
    }[];
  };

  const track = body.results?.find((entry) => entry.wrapperType === "track");
  if (!track) {
    throw new Error("Nothing found for that id — is it an album rather than a song?");
  }
  if (!track.previewUrl) {
    throw new Error(`"${track.trackName}" has no preview on the store.`);
  }

  return {
    id: track.trackId ?? id,
    title: track.trackName ?? "Unknown",
    artist: track.artistName ?? "Unknown",
    album: track.collectionName ?? "",
    genre: track.primaryGenreName ?? null,
    previewUrl: track.previewUrl,
    artworkUrl100: track.artworkUrl100 ?? null,
  };
}

/** Artwork at the size asked for; Apple's CDN resizes from the path. */
export function artworkAt(song: Song, size: number): string | null {
  return song.artworkUrl100?.replace(/100x100bb/, `${size}x${size}bb`) ?? null;
}
