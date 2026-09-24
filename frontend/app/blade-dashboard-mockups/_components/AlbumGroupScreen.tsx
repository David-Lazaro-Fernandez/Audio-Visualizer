"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { BladeScreenSurface } from "./BladeBackground";
import { gradientCss, MEDIA_GRADIENT } from "./blade-gradient";
import { BladeChromeBand, CONTENT_BAND_SHADOW } from "./BladeChromeBand";
import { ButtonLegendBar } from "./ButtonLegendBar";
import {
  LibraryMenu,
  LibraryMenuProvider,
  useHighlightedItem,
  type LibraryMenuItem,
} from "./LibraryMenu";
import { MEDIA_THEME, themeVars } from "./blade-theme";
import { getPortalRoot } from "./portal";
import { MediaSlot } from "./MediaSlot";
import { ScrollColumn } from "./ScrollColumn";
import { AlbumArt } from "./RowArt";
import { AlbumScreen } from "./AlbumScreen";
import {
  albumArtworkUrl,
  albumGenre,
  albumTracks,
  type AlbumGroup,
} from "./album-details";
import { artistImageUrl } from "./artist-images";
import type { MenuScreenProps } from "./MenuListItem";

/**
 * The artist and the genre screen, which a row of the Artists or the
 * Genres category of the Music Library list opens (DESIGN.md §6.21).
 * The path is: Media blade, Music, Music Library, this screen, then an
 * album (§6.14).
 *
 * It has the same full-screen structure as each other surface that the
 * Media blade opens (§5.4, §6.12): the section gradient with the water
 * and no clip, the header and legend bands, the content as one raised
 * slab with `CONTENT_BAND_SHADOW`, and 12% side padding. It is in the
 * blue of the Media blade with its text and rule tints, because a
 * full-screen surface portals outside the canvas.
 *
 * One component serves an artist and a genre, because `AlbumGroup` is
 * one shape: a name and the albums under it. Only the header and the
 * labels of the screen reader change, through `kind`.
 *
 * It takes the two-column grammar of the Music screen (§6.11) and not
 * the one of the album screen (§6.14): a list at the left and a pane at
 * the right, and no column of actions. There is no action to offer
 * here that works. The player is bound to one album (§6.16), thus a
 * "Play Artist" row would have to build a queue across albums, and an
 * image is what this screen has to show: the artist's photo, or the
 * sleeve of the record under the cursor.
 *
 * The albums are the albums of the library and not the discography of
 * the store; refer to `AlbumGroup` for why.
 *
 * The row that opened this screen owns Back (`MenuListItem` with
 * `useBackKey`), thus this screen takes no `onClose`.
 */

/** The same radial blue as the canvas of the Media blade (DESIGN.md §2.1). */
const BACKGROUND = gradientCss(MEDIA_GRADIENT);

export function AlbumGroupScreen({
  group,
  kind,
}: {
  group: AlbumGroup;
  kind: "artist" | "genre";
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    rootRef.current
      ?.querySelector<HTMLElement>("[data-nav-item]:not(:disabled)")
      ?.focus();
    return () => opener?.focus();
  }, []);

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={group.name}
      className="fixed inset-0 z-40 flex flex-col text-(--blade-ink)"
      style={{ background: BACKGROUND, ...themeVars(MEDIA_THEME) }}
    >
      <BladeScreenSurface gradient={MEDIA_GRADIENT} />

      {/* The header and the legend are at z-0, below the shadow of the content band. */}
      <BladeChromeBand
        edge="top"
        className="relative z-0 px-[12%] pt-8 pb-5 md:pt-10 md:pb-6"
      >
        <h1 className="truncate text-3xl text-white [text-shadow:0_1px_2px_rgba(0,0,0,.28)] sm:text-4xl">
          {group.name}
        </h1>
      </BladeChromeBand>

      <Columns group={group} kind={kind} />

      <BladeChromeBand
        edge="bottom"
        className="relative z-0 px-[12%] pt-4 pb-8 md:pb-10"
      >
        <ButtonLegendBar
          left={[
            { label: "Y", letter: "Y", disabled: true },
            { label: "X", letter: "X", disabled: true },
          ]}
          right={[
            { label: "Back", letter: "B" },
            { label: "Select", letter: "A", sizePx: 28, fontSizePx: 21 },
          ]}
        />
      </BladeChromeBand>
    </div>,
    getPortalRoot(),
  );
}

/**
 * The list and the pane. The list is the only column with a cursor,
 * thus Left and Right do nothing here and the screen needs no handler
 * to hand the cursor across. The grid takes `data-nav-list` so that Up
 * and Down walk the rows and `KeyboardNav` does not switch the blades
 * below.
 */
function Columns({ group, kind }: { group: AlbumGroup; kind: "artist" | "genre" }) {
  // Each row carries a component that is bound to its album (§6.12). A
  // rebuild at each render would give React a new component type each
  // time and would remount the open album screen under the cursor.
  const items: LibraryMenuItem[] = useMemo(
    () =>
      group.albums.map((album) => {
        const Screen: React.ComponentType<MenuScreenProps> = () => (
          <AlbumScreen album={album} />
        );
        Screen.displayName = `AlbumScreen(${album.title})`;
        return {
          label: album.title,
          icon: <AlbumArt album={album} />,
          screen: Screen,
        };
      }),
    [group],
  );

  return (
    <LibraryMenuProvider initialItem={items[0]}>
      <div
        data-nav-list="column"
        className="relative z-10 grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_auto] gap-8 overflow-hidden px-[12%] py-6 md:grid-cols-[minmax(0,45%)_1fr] md:grid-rows-[minmax(0,1fr)] md:gap-12"
        style={{ boxShadow: CONTENT_BAND_SHADOW }}
      >
        <div className="flex min-h-0 min-w-0 flex-col">
          <ScrollColumn footer={<AlbumCounter group={group} />}>
            <LibraryMenu
              layout="buttons"
              compact
              items={items}
              ariaLabel={`Albums by ${group.name}`}
            />
          </ScrollColumn>
        </div>

        <Pane group={group} kind={kind} />
      </div>
    </LibraryMenuProvider>
  );
}

/** The box of the hero. It is the largest size that the column shows. */
const HERO_PX = 220;

/**
 * The pane at the right: a hero image, then the album that the cursor
 * is on.
 *
 * **The hero is the subject of the screen.** On an artist screen that
 * is the artist's photo, which is fixed while the cursor runs down
 * their records; the highlighted album then sits below it at row size,
 * so the pane says "this artist, this record of theirs". On a genre
 * screen there is no such subject — the store has no picture of a
 * genre — so the hero is the highlighted album's own sleeve and it
 * moves with the cursor.
 *
 * The genre is printed on an artist screen only. On a genre screen
 * every row has the genre in the header, so repeating it under each
 * one would say nothing; that screen shows the artist instead.
 *
 * It is a readout and never a cursor stop (§6.9).
 */
function Pane({ group, kind }: { group: AlbumGroup; kind: "artist" | "genre" }) {
  const highlighted = useHighlightedItem();
  const album =
    group.albums.find((entry) => entry.title === highlighted?.label) ??
    group.albums[0];
  if (!album) return null;

  const trackCount = albumTracks(album).length;
  const photo = kind === "artist" ? artistImageUrl(group.name, HERO_PX * 2) : null;

  return (
    <div aria-live="polite" className="flex min-w-0 flex-col gap-5 pt-2">
      <Hero
        src={photo ?? albumArtworkUrl(album, HERO_PX * 2)}
        // An artist with no photo falls back to the striped slot rather
        // than to the sleeve: the hero is the subject of the screen,
        // and swapping in a record would make it move with the cursor
        // on one artist and not on the next.
        label={kind === "artist" ? "artist photo" : "album art"}
      />

      <div className="flex min-w-0 items-start gap-4">
        {/* On an artist screen the hero is the artist, so the album
            needs its own sleeve to be named. On a genre screen the hero
            already is that sleeve. */}
        {kind === "artist" && <AlbumArt album={album} />}
        <div className="min-w-0">
          <p className="text-[30px] leading-tight text-balance">{album.title}</p>
          {kind === "genre" && album.artist && (
            <p className="text-[24px] leading-snug text-(--blade-ink-soft)">
              {album.artist}
            </p>
          )}
          <dl className="mt-3 text-[22px] leading-snug">
            {kind === "artist" && albumGenre(album) && (
              <Fact label="Genre" value={albumGenre(album)!} />
            )}
            {trackCount > 0 && <Fact label="Tracks" value={String(trackCount)} />}
          </dl>
        </div>
      </div>
    </div>
  );
}

/** One label-over-value pair, as the song screen stacks its tags (§6.15). */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2">
      <dt className="text-[20px] text-(--blade-ink-soft)">{label}</dt>
      <dd className="text-[24px] text-(--blade-ink)">{value}</dd>
    </div>
  );
}

/**
 * The hero image. A subject with no artwork shows the striped
 * placeholder of §6.7 in the same box, thus the pane keeps its height
 * whether or not the store has a picture.
 *
 * The CDN of Apple resizes from the path, and the caller asks for two
 * times the box so the image is sharp on a retina panel.
 */
function Hero({ src, label }: { src: string | null; label: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="w-full max-w-[220px]">
      {src && !failed ? (
        <Image
          src={src}
          // The image is decoration: the header and the pane name it.
          alt=""
          width={HERO_PX * 2}
          height={HERO_PX * 2}
          onError={() => setFailed(true)}
          className="aspect-square w-full rounded-[10px] object-cover"
        />
      ) : (
        <MediaSlot label={label} className="aspect-square" />
      )}
    </div>
  );
}

/** The "1 of 6" counter at the foot of the list. It follows the cursor. */
function AlbumCounter({ group }: { group: AlbumGroup }) {
  const highlighted = useHighlightedItem();
  const index = group.albums.findIndex(
    (album) => album.title === highlighted?.label,
  );
  return (
    <p aria-live="polite" className="pl-5 text-[22px] text-(--blade-ink)">
      {group.albums.length === 0 ? 0 : Math.max(index, 0) + 1} of{" "}
      {group.albums.length}
    </p>
  );
}

/**
 * A screen that is bound to one group, for a menu row to open (refer to
 * `screens.tsx`). The browse list builds these one time at module
 * scope, thus the component types are stable and an open does not
 * remount a screen.
 */
export function albumGroupScreenFor(
  group: AlbumGroup,
  kind: "artist" | "genre",
): React.ComponentType<MenuScreenProps> {
  const Screen: React.ComponentType<MenuScreenProps> = () => (
    <AlbumGroupScreen group={group} kind={kind} />
  );
  Screen.displayName = `AlbumGroupScreen(${group.name})`;
  return Screen;
}
