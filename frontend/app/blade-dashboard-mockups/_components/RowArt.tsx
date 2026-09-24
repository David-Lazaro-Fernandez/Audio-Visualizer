"use client";

import { useState } from "react";
import Image from "next/image";
import { albumArtworkUrl } from "./album-details";
import { artistImageUrl } from "./artist-images";
import type { Album } from "./albums";

/**
 * The artwork in the 24 px icon box of a browse row (DESIGN.md §6.12),
 * in place of the neutral square: an album's sleeve, and an artist's
 * photo.
 *
 * `MenuListItem` makes only an `svg` glyph larger, thus a bitmap keeps
 * the size of the box. A row with artwork that does not load, or with
 * none at all, falls back to that neutral square and never shows a
 * broken image, as the Achievements screen does (§6.10). The row itself
 * stays: on that screen the art is the item, and here it only
 * illustrates a name that is complete without it. "Various Artists" is
 * the one name in the library with no photo, because it is not an
 * artist.
 *
 * It is its own module because two screens show these rows: the Music
 * Library list (§6.12) and the artist or genre screen (§6.21). The
 * second opens from the first, thus an export from either one would be
 * an import cycle.
 */

/** The box. It is the same `h-6 w-6` as the neutral square. */
const ART_PX = 24;

export function AlbumArt({ album }: { album: Album }) {
  // The CDN of Apple resizes from the path, thus ask for the size that
  // the screen shows.
  return <RowArt src={albumArtworkUrl(album, ART_PX * 4)} />;
}

export function ArtistArt({ name }: { name: string }) {
  return <RowArt src={artistImageUrl(name, ART_PX * 4)} />;
}

function RowArt({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span
        aria-hidden="true"
        className="block h-6 w-6 shrink-0 rounded-[4px] bg-[rgba(0,0,0,.22)]"
      />
    );
  }
  return (
    <Image
      src={src}
      // The image is decoration: the label of the row names it.
      alt=""
      // Two times the box, thus the image is sharp on a retina panel. A
      // larger variant would waste the work of the optimizer.
      width={ART_PX * 2}
      height={ART_PX * 2}
      onError={() => setFailed(true)}
      className="h-6 w-6 shrink-0 rounded-[4px] object-cover"
    />
  );
}
