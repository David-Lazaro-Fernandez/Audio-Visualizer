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
 * The "Audiobooks" browse screen the Music screen's Hard Drive row opens
 * (DESIGN.md §6.12) — Media blade → Music → here. Same full-screen
 * structure as the Games Library and My Games (§5.4): the section
 * gradient with the unclipped wave sheen, darker header and legend bands,
 * the content raised as one slab with `CONTENT_BAND_SHADOW`, 12% side
 * padding — only painted in the Media blade's sky blue, with its text and
 * rule tints (`MEDIA_THEME`) set on the root since full-screen surfaces
 * portal outside the canvas and would otherwise inherit the games green.
 *
 * Left column: the console's browse categories — Albums, Artists, Saved
 * Playlists, Songs, Genres — as the blade's divider-separated rows (§6.2
 * `row`) with the cursor chevron, since each one has a list to its right.
 * Right column: the highlighted category's entries as compact raised
 * buttons (§6.2 `button`, `compact`) in a scrolling column with the "1 of
 * N" counter and the more-below arrow at its foot. Hover or focus on a
 * category swaps the list, as the console did; Select or Right moves the
 * cursor into the list, Left from the list returns to the category.
 *
 * Two highlight providers nest: the outer one follows the category rows
 * and picks the list, the inner one follows the list rows and drives the
 * counter, so hovering an album never changes which category is open.
 *
 * Icons: the console's category glyphs are full-colour bitmaps, so per
 * §6.2 they are not redrawn — the rows show the neutral square until the
 * images are dropped in as `icon: <Image src="/assets/…" />`. Albums reuses
 * the disc-and-note `music` glyph the set already has.
 *
 * The album rows themselves carry their sleeve, linked from Apple's
 * artwork CDN (`album-details.ts`, `scripts/fetch-apple-music.mts`). An
 * album with no cover keeps the neutral square, so the shelf reads the
 * same whether or not a sleeve was found.
 *
 * Legend, as on the console: Y Play All Music, X unbound; Back B, A unbound.
 * Back is owned by the row that opened this screen (`MenuListItem` +
 * `useBackKey`), so this takes no props.
 */
interface CategoryEntry {
  label: string;
  /** Album sleeve; the other categories are text only, as on the console. */
  icon?: React.ReactNode;
  /** Full-screen destination, for the album rows (§6.14). */
  screen?: React.ComponentType<MenuScreenProps>;
}

interface Category {
  label: string;
  icon?: React.ReactNode;
  entries: CategoryEntry[];
}

/** Text-only entries, for every category but Albums. */
const plain = (...labels: string[]): CategoryEntry[] =>
  labels.map((label) => ({ label }));

/**
 * One album's sleeve, at the 24 px the neutral square it replaces
 * occupies — `MenuListItem` only oversizes `svg` glyphs, so a bitmap sits
 * in the icon box as-is.
 *
 * A row whose file is missing falls back to that same neutral square
 * rather than a broken image, the way the Achievements screen reacts to
 * art that will not load (§6.10). It does *not* drop the row: there the
 * art is the item, here it only illustrates a title that stands on its
 * own.
 */
/** Box the sleeve sits in, matching the neutral square's `h-6 w-6`. */
const ART_PX = 24;

function AlbumArt({ album }: { album: Album }) {
  const [failed, setFailed] = useState(false);
  // Apple's CDN resizes from the path, so ask for what we display.
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
      // Decorative: the row's own label already names the album.
      alt=""
      // Twice the box, so it is crisp on a retina panel without asking
      // the optimizer for a variant ten times bigger than it can show.
      width={ART_PX * 2}
      height={ART_PX * 2}
      onError={() => setFailed(true)}
      className="h-6 w-6 shrink-0 rounded-[4px] object-cover"
    />
  );
}

/**
 * Every album row opens its own album screen (§6.14). The screen takes
 * the album as an argument, so it cannot be referenced by a `ScreenKey`
 * the way the fixed destinations are — each row carries a component bound
 * to its album instead. Built once at module scope so those component
 * types are stable and opening a screen does not remount it.
 */
const ALBUM_ENTRIES: CategoryEntry[] = ALBUMS.map((album) => {
  // Annotated so `displayName` is assignable: a bare arrow has no such
  // property, only a FunctionComponent does. `AlbumScreen` is referenced
  // from inside the body, not at module-evaluation time, which keeps the
  // import cycle through `screens.tsx` harmless the same way
  // `resolveScreen` does.
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

/** Same radial blue as the Media blade canvas (DESIGN.md §2.1). */
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

      {/* Header and legend sit at z-0, beneath the content band's shadow. */}
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
 * The two columns. Lives inside the outer `LibraryMenuProvider` so it can
 * read the highlighted category and mount the matching list, keyed by
 * category so a switch remounts the list with the cursor context reset.
 *
 * Left/Right hand the cursor between the columns: Right from a category
 * lands on the list's first row, Left from any list row returns to the
 * category that owns it. Both claim the key so `KeyboardNav` leaves it.
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
    // Select commits the category and moves the cursor into its list
    // (`MenuListItem` plays Select A).
    onSelect: focusFirstEntry,
  }));

  const entryItems: LibraryMenuItem[] = category.entries.map((entry) => ({
    label: entry.label,
    icon: entry.icon,
    screen: entry.screen,
    // Categories with no destination yet just play Select A, as the
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

/** "1 of 273" at the foot of the list, following the cursor through the inner provider. */
function EntryCounter({ entries }: { entries: CategoryEntry[] }) {
  const highlighted = useHighlightedItem();
  const index = entries.findIndex((entry) => entry.label === highlighted?.label);
  return (
    <p aria-live="polite" className="pl-5 text-[22px] text-(--blade-ink)">
      {entries.length === 0 ? 0 : Math.max(index, 0) + 1} of {entries.length}
    </p>
  );
}
