"use client";

import { useEffect, useRef, useState } from "react";
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
import { MenuIcon } from "./MenuIcons";
import { ALBUMS, type Album } from "./albums";
import { albumArtworkUrl } from "./album-details";
import { AlbumScreen } from "./AlbumScreen";
import type { MenuScreenProps } from "./MenuListItem";
import { MEDIA_THEME, themeVars } from "./blade-theme";
import { getPortalRoot } from "./portal";
import { ScrollColumn } from "./ScrollColumn";
import { playSound } from "./sounds";

/**
 * The Audiobooks browse screen, which the Hard Drive row of the Music
 * screen opens (DESIGN.md §6.12). The path is: Media blade, Music, this
 * screen. It has the same full-screen structure as the Games Library and
 * My Games (§5.4): the section gradient with the wave sheen and no clip,
 * darker header and legend bands, the content as one raised slab with
 * `CONTENT_BAND_SHADOW`, and 12% side padding. It is in the sky blue of
 * the Media blade, and it sets the text and rule tints of that blade
 * (`MEDIA_THEME`) on its root. A full-screen surface portals outside the
 * canvas, thus without those tints it would take the games green.
 *
 * The left column is the browse categories of the console, which are
 * Albums, Artists, Saved Playlists, Songs and Genres. They are the
 * divider-separated rows of the blade (§6.2 `row`) with the cursor
 * chevron, because each one has a list at its right. The right column is
 * the entries of the highlighted category, as compact raised buttons
 * (§6.2 `button`, `compact`), in a scrolling column with the "1 of N"
 * counter and the more-below arrow at its foot. A hover or a focus on a
 * category changes the list, as on the console. Select or Right moves
 * the cursor into the list, and Left from the list returns to the
 * category.
 *
 * Two highlight providers nest. The outer provider follows the category
 * rows and selects the list. The inner provider follows the list rows
 * and drives the counter. Thus a hover on an album does not change the
 * open category.
 *
 * Icons: the category glyphs of the console are full-colour bitmaps,
 * thus §6.2 does not redraw them. The rows show the neutral square until
 * someone adds the images as `icon: <Image src="/assets/..." />`. Albums
 * uses the disc-and-note `music` glyph that the set already has.
 *
 * Each album row carries its sleeve, linked from the artwork CDN of
 * Apple (`album-details.ts`, `scripts/fetch-apple-music.mts`). An album
 * with no cover keeps the neutral square, thus the list looks the same
 * with and without a sleeve.
 *
 * The legend is the legend of the console: Y Play All Music, X unbound,
 * Back B and A unbound. The row that opened this screen owns Back
 * (`MenuListItem` with `useBackKey`), thus this screen takes no props.
 */
interface CategoryEntry {
  label: string;
  /** The album sleeve. The other categories are text only, as on the console. */
  icon?: React.ReactNode;
  /** The full-screen destination of an album row (§6.14). */
  screen?: React.ComponentType<MenuScreenProps>;
}

interface Category {
  label: string;
  icon?: React.ReactNode;
  entries: CategoryEntry[];
}

/** Entries with text only, for each category but Albums. */
const plain = (...labels: string[]): CategoryEntry[] =>
  labels.map((label) => ({ label }));

/**
 * The sleeve of one album, at the 24 px of the neutral square that it
 * replaces. `MenuListItem` makes only an `svg` glyph larger, thus a
 * bitmap keeps its size in the icon box.
 *
 * A row with a missing file falls back to that neutral square and does
 * not show a broken image, as the Achievements screen does with art that
 * does not load (§6.10). This row stays in the list: on that screen the
 * art is the item, and here it only illustrates a title that is
 * complete without it.
 */
/** The box of the sleeve. It is the same `h-6 w-6` as the neutral square. */
const ART_PX = 24;

function AlbumArt({ album }: { album: Album }) {
  const [failed, setFailed] = useState(false);
  // The CDN of Apple resizes from the path, thus ask for the size that
  // the screen shows.
  const src = albumArtworkUrl(album, ART_PX * 4);
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
      // The image is decoration: the label of the row names the album.
      alt=""
      // Two times the box, thus the image is sharp on a retina panel.
      // A larger variant would waste the work of the optimizer.
      width={ART_PX * 2}
      height={ART_PX * 2}
      onError={() => setFailed(true)}
      className="h-6 w-6 shrink-0 rounded-[4px] object-cover"
    />
  );
}

/**
 * Each album row opens its own album screen (§6.14). The screen takes
 * the album as an argument, thus a `ScreenKey` cannot name it, as it
 * names the fixed destinations. Each row carries a component that is
 * bound to its album. The code builds these components one time at
 * module scope, thus the component types are stable and an open does not
 * remount a screen.
 */
const ALBUM_ENTRIES: CategoryEntry[] = ALBUMS.map((album) => {
  // The type annotation makes `displayName` assignable: a plain arrow
  // function has no such property and a FunctionComponent has one. The
  // body reads `AlbumScreen`, and the module evaluation does not. Thus
  // the import cycle through `screens.tsx` is safe, as with
  // `resolveScreen`.
  const Screen: React.ComponentType<MenuScreenProps> = () => (
    <AlbumScreen album={album} />
  );
  Screen.displayName = `AlbumScreen(${album.title})`;
  return {
    label: album.title,
    icon: <AlbumArt album={album} />,
    screen: Screen,
  };
});

const CATEGORIES: Category[] = [
  {
    label: "Albums",
    icon: <MenuIcon name="music" />,
    entries: ALBUM_ENTRIES,
  },
  {
    label: "Artists",
    entries: plain(
      "Unknown Artist",
      "A Flock Of Seagulls",
      "Adele",
      "Coldplay",
      "Daft Punk",
      "Green Day",
      "Linkin Park",
      "Massive Attack",
      "Muse",
      "Oasis",
      "Pink Floyd",
      "Queen",
      "The National",
    ),
  },
  {
    label: "Saved Playlists",
    entries: plain("Driving", "Late Night", "Party Mix", "Workout"),
  },
  {
    label: "Songs",
    entries: plain(
      "Unknown Song",
      "21 Guns",
      "Around the World",
      "Bohemian Rhapsody",
      "Champagne Supernova",
      "Clocks",
      "Comfortably Numb",
      "I Ran (So Far Away)",
      "In the End",
      "Rolling in the Deep",
      "Teardrop",
      "Uprising",
    ),
  },
  {
    label: "Genres",
    entries: plain("Unknown Genre", "Alternative", "Electronic", "Pop", "Rock", "Trip Hop"),
  },
];

/** The same radial blue as the canvas of the Media blade (DESIGN.md §2.1). */
const BACKGROUND = gradientCss(MEDIA_GRADIENT);

export function AudiobooksScreen() {
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
      aria-label="Audiobooks"
      className="fixed inset-0 z-40 flex flex-col text-(--blade-ink)"
      style={{ background: BACKGROUND, ...themeVars(MEDIA_THEME) }}
    >
      <BladeScreenSurface gradient={MEDIA_GRADIENT} />

      {/* The header and the legend are at z-0, below the shadow of the content band. */}
      <BladeChromeBand
        edge="top"
        className="relative z-0 px-[12%] pt-8 pb-5 md:pt-10 md:pb-6"
      >
        <h1 className="text-3xl text-white [text-shadow:0_1px_2px_rgba(0,0,0,.28)] sm:text-4xl">
          Audiobooks
        </h1>
      </BladeChromeBand>

      <LibraryMenuProvider initialItem={CATEGORIES[0]}>
        <Browser />
      </LibraryMenuProvider>

      <BladeChromeBand
        edge="bottom"
        className="relative z-0 px-[12%] pt-4 pb-8 md:pb-10"
      >
        <ButtonLegendBar
          left={[
            { label: "Play All Music", letter: "Y" },
            { label: "X", letter: "X", disabled: true },
          ]}
          right={[
            { label: "Back", letter: "B" },
            { label: "A", letter: "A", disabled: true, sizePx: 28 },
          ]}
        />
      </BladeChromeBand>
    </div>,
    getPortalRoot(),
  );
}

/**
 * The two columns. This component is inside the outer
 * `LibraryMenuProvider`, thus it can read the highlighted category and
 * mount the correct list. The list is keyed by the category, thus a
 * change of category remounts the list and resets the cursor context.
 *
 * Left and Right move the cursor between the columns. Right from a
 * category goes to the first row of the list, and Left from a list row
 * returns to the category that owns the list. Both columns take the key,
 * thus `KeyboardNav` does not use it.
 */
function Browser() {
  const highlighted = useHighlightedItem();
  const category =
    CATEGORIES.find((entry) => entry.label === highlighted?.label) ?? CATEGORIES[0];
  const listRef = useRef<HTMLDivElement>(null);
  const categoriesRef = useRef<HTMLDivElement>(null);

  const focusFirstEntry = () => {
    const first = listRef.current?.querySelector<HTMLElement>("[data-nav-item]");
    if (!first) return;
    first.focus();
    playSound("select");
  };

  const focusCategory = () => {
    const index = CATEGORIES.indexOf(category);
    const rows = categoriesRef.current?.querySelectorAll<HTMLElement>("[data-nav-item]");
    const row = rows?.[index];
    if (!row) return;
    row.focus();
    playSound("select");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (e.key === "ArrowRight" && categoriesRef.current?.contains(target)) {
      e.preventDefault();
      focusFirstEntry();
    } else if (e.key === "ArrowLeft" && listRef.current?.contains(target)) {
      e.preventDefault();
      focusCategory();
    }
  };

  const categoryItems: LibraryMenuItem[] = CATEGORIES.map((entry) => ({
    label: entry.label,
    icon: entry.icon,
    chevron: true,
    // Select confirms the category and moves the cursor into its list.
    // `MenuListItem` plays Select A.
    onSelect: focusFirstEntry,
  }));

  const entryItems: LibraryMenuItem[] = category.entries.map((entry) => ({
    label: entry.label,
    icon: entry.icon,
    screen: entry.screen,
    // A category with no destination plays Select A only, as the
    // Achievements grid did before its detail screen existed.
    onSelect: () => {},
  }));

  return (
    <div
      onKeyDown={onKeyDown}
      className="relative z-10 grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-8 overflow-hidden px-[12%] py-6 md:grid-cols-2 md:grid-rows-[minmax(0,1fr)] md:gap-8"
      style={{ boxShadow: CONTENT_BAND_SHADOW }}
    >
      <div ref={categoriesRef} data-nav-list="column" className="flex min-w-0 flex-col">
        <LibraryMenu items={categoryItems} ariaLabel="Browse music by" />
      </div>

      <div ref={listRef} data-nav-list="column" className="flex min-h-0 min-w-0 flex-col">
        <LibraryMenuProvider key={category.label} initialItem={entryItems[0]}>
          <ScrollColumn footer={<EntryCounter entries={category.entries} />}>
            <LibraryMenu
              layout="buttons"
              compact
              items={entryItems}
              ariaLabel={category.label}
            />
          </ScrollColumn>
        </LibraryMenuProvider>
      </div>
    </div>
  );
}

/** The "1 of 273" counter at the foot of the list. It follows the cursor through the inner provider. */
function EntryCounter({ entries }: { entries: CategoryEntry[] }) {
  const highlighted = useHighlightedItem();
  const index = entries.findIndex((entry) => entry.label === highlighted?.label);
  return (
    <p aria-live="polite" className="pl-5 text-[22px] text-(--blade-ink)">
      {entries.length === 0 ? 0 : Math.max(index, 0) + 1} of {entries.length}
    </p>
  );
}
