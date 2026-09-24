/**
 * The photo of each artist (DESIGN.md §6.12, §6.21).
 *
 * It is separate from `album-details.ts` for the reason that file is
 * separate from `albums.ts`: this is a different fetch with a different
 * source, and an artist is not a detail of an album. Both are written
 * by `scripts/fetch-apple-music.mts`.
 *
 * **The Search API has no artist artwork.** A lookup of an artist
 * entity returns the name, the link and the genre and no image field of
 * any kind, and the Apple Music API, which does carry
 * `attributes.artwork`, needs a MusicKit developer token. So the script
 * reads the `og:image` of the artist's public page instead, whose URL
 * (`artistViewUrl`) arrives with the album lookup it already makes.
 *
 * What comes back is on the same `mzstatic` CDN as the album artwork,
 * with the same size template in the path and the same
 * `Access-Control-Allow-Origin: *`. Thus one stored URL serves every
 * size the UI wants, the artwork is linked rather than checked in, and
 * nothing here differs from the album case at the point of use.
 *
 * An artist with no photo keeps the neutral square, exactly as an album
 * with no cover does. "Various Artists" is the one name in the library
 * that has none: it is not an artist and has no page.
 */

import ARTIST_IMAGES from "./artist-images.json";

interface ArtistImage {
  artistId: number;
  /** The artwork URL with no size segment. Refer to `artistImageUrl`. */
  artworkBase: string;
}

const IMAGES = ARTIST_IMAGES as Record<string, ArtistImage>;

/**
 * The photo at the given size, or null when the artist has none.
 *
 * The album case rewrites the `100x100bb` segment of a stored URL
 * (`albumArtworkUrl`), because every album comes back at that one size.
 * An artist photo arrives as `1200x630cw.png` and that segment is not
 * fixed, so the script stores the URL without it and this appends the
 * square that the UI wants. The CDN resizes on demand either way.
 */
export function artistImageUrl(artist: string, size: number): string | null {
  const base = IMAGES[artist]?.artworkBase;
  return base ? `${base}/${size}x${size}bb.jpg` : null;
}
