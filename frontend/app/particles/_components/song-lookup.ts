"use client";

/**
 * Resolves an Apple Music link to a playable preview, in the browser.
 *
 * The iTunes Search API needs no key and answers with
 * `Access-Control-Allow-Origin: *`. Thus this page can look up a song
 * from the client with no route handler. The albums of the dashboard are
 * different: a script resolves them one time and the data is checked in
 * (`scripts/fetch-apple-music.mts`), because a dashboard must not search
 * a store at render time. Here a user can paste any song, thus the
 * lookup must occur live.
 */

export interface Song {
  id: number;
  title: string;
  artist: string;
  album: string;
  genre: string | null;
  /** A 30-second AAC preview. The store serves it CORS-open. */
  previewUrl: string;
  /** The URL of the 100 px artwork. You can change the size segment. */
  artworkUrl100: string | null;
}

/**
 * Finds the track id in the pasted text.
 *
 * A song link ends with the id (`/song/<slug>/<id>`). A track that a
 * user reaches through its album has the id in `?i=`, and the id in the
 * path is the id of the album. Thus the query parameter has priority, or
 * the page analyses the incorrect track. A number alone is also valid.
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
  // The endpoint answers as text/javascript, thus parse the body here.
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

/** Artwork at the given size. The CDN of Apple resizes from the path. */
export function artworkAt(song: Song, size: number): string | null {
  return song.artworkUrl100?.replace(/100x100bb/, `${size}x${size}bb`) ?? null;
}
