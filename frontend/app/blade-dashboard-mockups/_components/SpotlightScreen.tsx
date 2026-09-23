"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BladeScreenSurface } from "./BladeBackground";
import { gradientCss, STORE_GRADIENT } from "./blade-gradient";
import { STORE_THEME, themeVars } from "./blade-theme";
import { BladeChromeBand, CONTENT_BAND_SHADOW } from "./BladeChromeBand";
import { ButtonLegendBar } from "./ButtonLegendBar";
import {
  LibraryMenu,
  LibraryMenuProvider,
  useHighlightedItem,
  type LibraryMenuItem,
} from "./LibraryMenu";
import { RAISED_BORDER, RAISED_INSET_SHADOW } from "./MenuListItem";
import { MediaSlot } from "./MediaSlot";
import { XboxLiveBanner } from "./XboxLiveBanner";
import { getPortalRoot } from "./portal";
import { playSound } from "./sounds";

/**
 * The Spotlight screen, opened by the Marketplace blade's Spotlight tile
 * (DESIGN.md §6.20) — the first of the four stores to become a real
 * destination rather than a placeholder detail box (§6.19). Same
 * full-screen structure as the Games Library (§5.4) in the Marketplace
 * orange: section gradient, unclipped sheen, header and legend bands, the
 * content raised as one slab. It sets `STORE_THEME` on its root, because
 * a full-screen surface portals outside the canvas and would otherwise
 * take the games green (§5.4).
 *
 * A full-width `XboxLiveBanner` sits under the header, as on the console.
 * Below it a category carousel (`CategoryCarousel`) filters the list the
 * way the My Games tab strip does (§6.9): plain text tabs, masked to fade
 * at both edges, with a sliver of the trailing category left showing
 * through the fade as the carousel's own decorative wraparound. Left and
 * Right still clamp at the ends (§8) — the wraparound is a look, not a
 * loop.
 *
 * The list and detail panel below repeat the Games list/detail grammar
 * with the two differences that mark Marketplace content as not the
 * gamer's own: each row has no icon and stacks two lines (`subtitle` on
 * `MenuListItem`, added for this screen), and the detail panel is a
 * readout (§6.9 skin) of a darker title strip, an empty media slot (§6.7)
 * standing in for box art or a price, and the item's blurb, which is not
 * scrolled — the panel's height is fixed and `overflow-hidden` clips the
 * text where it runs past the bottom, exactly as the console cut its
 * last line off mid-character.
 *
 * The legend shows all four buttons live: Y "Marketplace Home" and X
 * "Add Microsoft Points" are not wired to a key, the same as the
 * blade-level "Sign Out" slot, because neither destination exists yet.
 */
type CategoryKey = "games" | "arcade" | "demos" | "free" | "videos" | "movies";

interface SpotlightCategory {
  key: CategoryKey;
  label: string;
}

const CATEGORIES: SpotlightCategory[] = [
  { key: "games", label: "Games" },
  { key: "arcade", label: "Arcade" },
  { key: "demos", label: "Demos" },
  { key: "free", label: "Free Stuff" },
  { key: "videos", label: "Videos" },
  { key: "movies", label: "Movies" },
];

interface SpotlightItem {
  title: string;
  /** The row's second line: the item's content type, such as "Game" or "Downloaded Content". */
  category: string;
  description: string;
}

const ITEMS: Record<CategoryKey, SpotlightItem[]> = {
  games: [
    {
      title: "Mass Effect",
      category: "Game",
      description:
        "Commander Shepard battles to stop a galactic threat in this cinematic sci-fi RPG, where every choice shapes the story.",
    },
    {
      title: "Ambition of the Illuminus",
      category: "Downloaded Content",
      description:
        "[ESRB: T (Teen) FANTASY VIOLENCE, MILD LANGUAGE, MILD SUGGESTIVE THEMES] Phantasy Star Universe: Ambition of the Illuminus is the enhanced edition of Phantasy Star Universe, adding new story missions, a level cap increase and cross-platform play with the PC version.",
    },
    {
      title: "Rock Band",
      category: "Game",
      description:
        "Grab a guitar, bass, drums or the mic and play together in the definitive music game experience.",
    },
    {
      title: "DMC4 Heroes and Heroine Pack",
      category: "Gamer Picture",
      description:
        "A gamer picture pack celebrating the heroes of Devil May Cry 4: Nero, Dante and Lady.",
    },
  ],
  arcade: [
    {
      title: "Hexic",
      category: "Arcade Game",
      description:
        "Spin clusters of hexagons into matching colors in this deceptively simple puzzle classic.",
    },
    {
      title: "Castle Crashers",
      category: "Arcade Game",
      description:
        "Four knights team up to rescue a kidnapped princess in this hand-drawn co-op brawler.",
    },
    {
      title: "Doritos Crash Course",
      category: "Arcade Game",
      description:
        "Sprint, slide and faceplant through a wipeout-style obstacle gauntlet for the leaderboard.",
    },
  ],
  demos: [
    {
      title: "Call of Duty: Modern Warfare 3",
      category: "Game Demo",
      description:
        "Try the opening mission of World War III before you buy the full campaign.",
    },
    {
      title: "Halo 3",
      category: "Game Demo",
      description:
        "Step into Master Chief's boots for a taste of the fight against the Covenant.",
    },
  ],
  free: [
    {
      title: "Recycle Avatar Award",
      category: "Free Avatar Item",
      description:
        "A free avatar award for gamers who complete select environmental challenges.",
    },
    {
      title: "Fall Dashboard Theme",
      category: "Free Theme",
      description: "Dress up your dashboard with this free seasonal theme.",
    },
  ],
  videos: [
    {
      title: "Halo 3: E3 Trailer",
      category: "Game Trailer",
      description: "Relive the cinematic reveal trailer that closed out E3 for Halo 3.",
    },
    {
      title: "Behind the Scenes: Mass Effect",
      category: "Video",
      description: "Go behind the scenes with the developers of Mass Effect.",
    },
  ],
  movies: [
    {
      title: "Iron Man",
      category: "Movie",
      description: "Tony Stark builds a suit of armor and becomes Iron Man in this origin story.",
    },
    {
      title: "The Dark Knight",
      category: "Movie",
      description: "Batman faces his greatest challenge yet in the Joker.",
    },
  ],
};

/** The same radial orange as the canvas of the Marketplace blade. */
const BACKGROUND = gradientCss(STORE_GRADIENT);

export function SpotlightScreen() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [categoryIndex, setCategoryIndex] = useState(0);
  const category = CATEGORIES[categoryIndex];
  const items = ITEMS[category.key];

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    return () => opener?.focus();
  }, []);

  // Put the cursor on the first row at the open and after each category
  // change, exactly as the My Games tab strip does (§6.9): a category
  // with no rows focuses the screen itself, thus Left and Right still
  // reach this root and can leave the category.
  useEffect(() => {
    const root = rootRef.current;
    const first = root?.querySelector<HTMLElement>(
      "[data-nav-list] [data-nav-item]:not(:disabled)",
    );
    (first ?? root)?.focus();
  }, [categoryIndex]);

  const stepCategory = (delta: 1 | -1) => {
    const next = categoryIndex + delta;
    if (next < 0 || next >= CATEGORIES.length) return;
    playSound("select");
    setCategoryIndex(next);
  };

  const selectCategory = (index: number) => {
    if (index === categoryIndex) return;
    playSound("selectA");
    setCategoryIndex(index);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      // Take Left and Right for the carousel. `KeyboardNav` ignores a
      // prevented event.
      e.preventDefault();
      stepCategory(e.key === "ArrowLeft" ? -1 : 1);
      return;
    }
    if (items.length === 0 && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
    }
  };

  const menuItems: LibraryMenuItem[] = items.map((item) => ({
    label: item.title,
    subtitle: item.category,
    icon: null,
    // No product page exists yet, thus Select only plays its sound, as
    // the Achievements grid did before its detail screen existed.
    onSelect: () => {},
  }));

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Spotlight"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-40 flex flex-col text-(--blade-ink) outline-none"
      style={{ background: BACKGROUND, ...themeVars(STORE_THEME) }}
    >
      <BladeScreenSurface gradient={STORE_GRADIENT} />

      <BladeChromeBand
        edge="top"
        className="relative z-0 px-[12%] pt-8 pb-5 md:pt-10 md:pb-6"
      >
        <h1 className="text-3xl text-white [text-shadow:0_1px_2px_rgba(0,0,0,.28)] sm:text-4xl">
          Spotlight
        </h1>
      </BladeChromeBand>

      <div
        className="relative z-10 flex min-h-0 flex-1 flex-col"
        style={{ boxShadow: CONTENT_BAND_SHADOW }}
      >
        <div className="px-[12%] pt-5">
          <XboxLiveBanner rings />
        </div>

        <CategoryCarousel
          categories={CATEGORIES}
          activeIndex={categoryIndex}
          onSelect={selectCategory}
        />

        <LibraryMenuProvider key={category.key} initialItem={items[0] && { label: items[0].title }}>
          <div
            data-nav-list="column"
            className="grid min-h-0 flex-1 grid-cols-1 gap-8 overflow-y-auto px-[12%] pt-3 pb-6 md:grid-cols-[minmax(0,55%)_1fr] md:gap-10"
          >
            <div className="flex min-w-0 flex-col">
              {items.length > 0 ? (
                <LibraryMenu items={menuItems} ariaLabel="Spotlight list" />
              ) : (
                <p className="px-[13px] py-3 text-[23px] text-(--blade-ink-soft)">
                  Nothing here yet.
                </p>
              )}
              <SpotlightCounter items={items} />
            </div>
            <SpotlightDetailPanel items={items} />
          </div>
        </LibraryMenuProvider>
      </div>

      <BladeChromeBand
        edge="bottom"
        className="relative z-0 px-[12%] pt-4 pb-8 md:pb-10"
      >
        <ButtonLegendBar
          left={[
            { label: "Marketplace Home", letter: "Y" },
            { label: "Add Microsoft Points", letter: "X" },
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

/** How far the carousel offsets the active category from the wrapped sliver before it. Refer to `CategoryCarousel`. */
const CAROUSEL_LEAD_PX = 24;

/**
 * The category tabs (DESIGN.md §6.20, §5.5): plain text, 40 px apart, the
 * active one white with the title's shadow. Unlike the My Games tab strip
 * this one is a carousel: the track carries an extra, decorative copy of
 * the last category before the first, and the whole row is masked to fade
 * at both edges. The track then slides so the active tab always lands
 * just past that leading sliver, which is what makes the strip read as
 * wrapping around rather than simply scrolling off. The wrap is a look,
 * not a loop: Left and Right still clamp at the ends of the real list
 * (§8), and the sliver never becomes selectable.
 */
function CategoryCarousel({
  categories,
  activeIndex,
  onSelect,
}: {
  categories: SpotlightCategory[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  const measure = () => {
    const track = trackRef.current;
    if (!track) return;
    const wrapped = track.children[0] as HTMLElement | undefined;
    const active = track.children[1 + activeIndex] as HTMLElement | undefined;
    if (!wrapped || !active) return;
    setOffset(active.offsetLeft - Math.max(0, wrapped.offsetWidth - CAROUSEL_LEAD_PX));
  };

  useLayoutEffect(measure, [activeIndex]);
  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  });

  return (
    <div
      role="tablist"
      aria-label="Spotlight categories"
      className="relative overflow-hidden px-[12%] py-3"
      style={{
        maskImage:
          "linear-gradient(90deg, transparent, #000 10%, #000 88%, transparent)",
        WebkitMaskImage:
          "linear-gradient(90deg, transparent, #000 10%, #000 88%, transparent)",
      }}
    >
      <div
        ref={trackRef}
        className="flex items-baseline gap-10 text-[26px] transition-transform duration-200 ease-out"
        style={{ transform: `translateX(${-offset}px)` }}
      >
        {/* The wraparound sliver: a decorative repeat of the last
            category, never a cursor stop and never clickable. */}
        <span aria-hidden="true" className="shrink-0 whitespace-nowrap text-(--blade-ink) opacity-70">
          {categories[categories.length - 1].label}
        </span>
        {categories.map((entry, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={entry.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              tabIndex={-1}
              onMouseEnter={() => !isActive && playSound("select")}
              onClick={() => onSelect(index)}
              className={`shrink-0 cursor-pointer whitespace-nowrap transition-colors duration-150 focus:outline-none ${
                isActive
                  ? "text-white [text-shadow:0_1px_2px_rgba(0,0,0,.28)]"
                  : "text-(--blade-ink) hover:text-white"
              }`}
            >
              {entry.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The "1 of 4" counter below the list. It follows the cursor, as the My Games counter does. */
function SpotlightCounter({ items }: { items: SpotlightItem[] }) {
  const highlighted = useHighlightedItem();
  const index = items.findIndex((item) => item.title === highlighted?.label);
  return (
    <p aria-live="polite" className="mt-auto pt-6 text-center text-[22px] text-(--blade-ink)">
      {items.length === 0 ? 0 : index + 1} of {items.length}
    </p>
  );
}

/**
 * The detail panel (DESIGN.md §6.20, §6.9 skin): a darker title strip, an
 * empty media slot (§6.7) standing in for the box art or the price the
 * console showed there, and the blurb. The blurb sits in a fixed-height,
 * `overflow-hidden` band and is not scrolled, thus a long description is
 * clipped where it runs past the bottom instead of fading or scrolling,
 * as the console's own panel cut its last line off mid-character.
 */
function SpotlightDetailPanel({ items }: { items: SpotlightItem[] }) {
  const highlighted = useHighlightedItem();
  const item = items.find((entry) => entry.title === highlighted?.label);
  if (!item) return null;

  return (
    <aside
      aria-live="polite"
      aria-label={`${item.title} details`}
      className={`flex min-h-[400px] min-w-0 flex-col overflow-hidden rounded-[10px] text-(--blade-ink) ${RAISED_BORDER} ${RAISED_INSET_SHADOW}`}
      style={{ background: "rgba(255,255,255,.12)" }}
    >
      <div className="bg-black/10 px-5 py-2 text-[24px] leading-tight">{item.title}</div>
      <MediaSlot label={item.category.toUpperCase()} className="mx-5 mt-4 h-[110px] shrink-0" />
      <div className="min-h-0 flex-1 overflow-hidden px-5 py-4">
        <p className="text-pretty text-[22px] leading-snug">{item.description}</p>
      </div>
    </aside>
  );
}
