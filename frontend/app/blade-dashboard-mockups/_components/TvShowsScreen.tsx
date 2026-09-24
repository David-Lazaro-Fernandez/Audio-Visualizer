"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
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
import { MenuIcon } from "./MenuIcons";
import { getPortalRoot } from "./portal";
import { playSound } from "./sounds";
import { ScrollColumn } from "./ScrollColumn";
import { asset } from "@/app/_lib/asset-path";
import {
  TOP_TV_EPISODES,
  TOP_TV_EPISODES_TOTAL,
  TV_SHOWS_PROMO,
  tvShowLogoUrl,
} from "./tv-shows";

/**
 * The TV Shows screen, opened by the Marketplace blade's Video Store
 * tile (DESIGN.md §6.19.3) — the third of the four stores to become a
 * real destination, after Spotlight (§6.20) and the Game Store
 * (§6.19.1). Same full-screen structure as the Games Library (§5.4) in
 * the Marketplace orange: section gradient, unclipped sheen, header and
 * legend bands, the content raised as one slab. It sets `STORE_THEME`
 * on its root, as Spotlight's and the Game Store's do (§5.4).
 *
 * Two columns, both interactive, bridged the way the Achievements
 * screen bridges its game filter and its tile grid (§6.10), because
 * `KeyboardNav` only moves within one `data-nav-list`: Right from the
 * menu enters the episode list, and Left from the episode list returns
 * to the highlighted menu tile.
 *
 * - **Menu** (left): five compact raised button tiles (§6.2 `button`
 *   `compact`, with `compactLarge` for a bigger icon and a taller band
 *   than the dense browse lists that skin usually carries) — New
 *   Arrivals, Networks & Studios, Shorts, Genres and
 *   All TV Shows — each with its own glyph from the monochrome set
 *   (§6.2). Genres is the one tile with a real destination, the
 *   Genres screen (§6.19.4); the rest launch the same URL as a cover
 *   of the Xbox Originals screen (`LAUNCH_URL`, as `MyGamesScreen.tsx`'s
 *   own), since none has a real one yet. Shorts, not the first tile,
 *   holds the cursor at the open, as the reference screenshot shows it
 *   highlighted. Below the tiles, a promo banner sits in the slot a
 *   sixth tile would take, a bitmap on the console (`TV_SHOWS_PROMO`,
 *   `public/assets/marketplace/tv-shows/`).
 * - **Top TV Episodes** (right): a static heading over a scrolling
 *   list (`ScrollColumn`) of the highest-ranked episodes, the blade's
 *   own divider rows (§6.2 `row`) with `subtitle` for the show's name
 *   and the show's own logo as the row's icon (`tvShowLogoUrl`), or the
 *   neutral placeholder square (§6.2) for a show with no logo yet. Each
 *   row also launches `LAUNCH_URL`, since there is no episode page yet.
 *   A "1 of 50" counter follows the cursor in the scroll column's own
 *   footer slot, but its denominator is the chart's real size
 *   (`TOP_TV_EPISODES_TOTAL`) and not the length of this mockup's five
 *   sample rows.
 *
 * Legend: Y "Marketplace Home" is live but unbound, the same
 * live-but-unbound kind of slot as the Game Store's own Y (§6.19.1); X
 * is dimmed, Back is B, Select is A.
 */
/** The destination of a launch, as `LAUNCH_URL` of `MyGamesScreen.tsx`. Every inert tile and episode row opens the same URL. */
const LAUNCH_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

function launchRickroll() {
  window.location.assign(LAUNCH_URL);
}

const TV_SHOWS_MENU_ITEMS: LibraryMenuItem[] = [
  { label: "New Arrivals", icon: <MenuIcon name="newArrivals" />, onSelect: launchRickroll },
  {
    label: "Networks & Studios",
    icon: <MenuIcon name="tvNetworks" />,
    onSelect: launchRickroll,
  },
  { label: "Shorts", icon: <MenuIcon name="shorts" />, onSelect: launchRickroll },
  { label: "Genres", icon: <MenuIcon name="tvGenres" />, screen: "genres" },
  {
    label: "All TV Shows",
    icon: <MenuIcon name="allTvShows" />,
    onSelect: launchRickroll,
  },
];

const EPISODE_ITEMS: LibraryMenuItem[] = TOP_TV_EPISODES.map((entry) => {
  const logo = tvShowLogoUrl(entry.show);
  return {
    label: entry.episode,
    subtitle: entry.show,
    ...(logo ? { icon: <EpisodeArt src={logo} /> } : {}),
    onSelect: launchRickroll,
  };
});

/** The same radial orange as the canvas of the Marketplace blade. */
const BACKGROUND = gradientCss(STORE_GRADIENT);

export function TvShowsScreen() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const tiles = rootRef.current?.querySelectorAll<HTMLElement>(
      "[data-nav-item]:not(:disabled)",
    );
    // Shorts, the third tile, holds the cursor at the open, as the
    // reference screenshot shows it highlighted.
    (tiles?.[2] ?? tiles?.[0])?.focus();
    return () => opener?.focus();
  }, []);

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="TV Shows"
      className="fixed inset-0 z-40 flex flex-col text-(--blade-ink) outline-none"
      style={{ background: BACKGROUND, ...themeVars(STORE_THEME) }}
    >
      <BladeScreenSurface gradient={STORE_GRADIENT} />

      <BladeChromeBand
        edge="top"
        className="relative z-0 px-[12%] pt-8 pb-5 md:pt-10 md:pb-6"
      >
        <h1 className="text-3xl text-white [text-shadow:0_1px_2px_rgba(0,0,0,.28)] sm:text-4xl">
          TV Shows
        </h1>
      </BladeChromeBand>

      <LibraryMenuProvider initialItem={TV_SHOWS_MENU_ITEMS[2]}>
        <TvShowsBody />
      </LibraryMenuProvider>

      <BladeChromeBand
        edge="bottom"
        className="relative z-0 px-[12%] pt-4 pb-8 md:pb-10"
      >
        <ButtonLegendBar
          left={[
            { label: "Marketplace Home", letter: "Y" },
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
 * The menu column and the episode list, bridged by Left and Right, as
 * `AchievementsBody` bridges its own two adjacent columns. This
 * component reads the highlighted menu tile through the outer
 * `LibraryMenuProvider`, purely to know which tile Left should return
 * to from the episode list.
 */
function TvShowsBody() {
  const highlighted = useHighlightedItem();
  const tileIndex = Math.max(
    0,
    TV_SHOWS_MENU_ITEMS.findIndex((item) => item.label === highlighted?.label),
  );

  const menuRef = useRef<HTMLDivElement>(null);
  const episodesRef = useRef<HTMLDivElement>(null);

  const focusFirstEpisode = () => {
    episodesRef.current?.querySelector<HTMLElement>("[data-nav-item]")?.focus();
  };

  const focusMenuTile = () => {
    const tiles = menuRef.current?.querySelectorAll<HTMLElement>("[data-nav-item]");
    tiles?.[tileIndex]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (e.key === "ArrowRight" && menuRef.current?.contains(target)) {
      e.preventDefault();
      if (episodesRef.current?.querySelector("[data-nav-item]")) {
        focusFirstEpisode();
        playSound("select");
      }
      return;
    }
    if (e.key === "ArrowLeft" && episodesRef.current?.contains(target)) {
      e.preventDefault();
      focusMenuTile();
      playSound("select");
    }
  };

  return (
    <div
      onKeyDown={onKeyDown}
      className="relative z-10 grid min-h-0 flex-1 grid-cols-1 gap-8 overflow-y-auto px-[12%] py-6 md:grid-cols-[minmax(0,42%)_1fr] md:gap-12"
      style={{ boxShadow: CONTENT_BAND_SHADOW }}
    >
      <div ref={menuRef} data-nav-list="column" className="flex min-w-0 flex-col gap-3">
        <LibraryMenu
          layout="buttons"
          compact
          compactLarge
          items={TV_SHOWS_MENU_ITEMS}
          ariaLabel="TV Shows menu"
        />
        <Image
          src={asset(TV_SHOWS_PROMO.image)}
          alt={TV_SHOWS_PROMO.alt}
          width={840}
          height={400}
          className="aspect-[21/10] w-full rounded-[10px] object-cover"
        />
      </div>

      <div
        ref={episodesRef}
        data-nav-list="column"
        className="flex min-h-0 min-w-0 flex-col"
      >
        <h2 className="mb-2 text-[30px] leading-tight text-(--blade-ink)">
          Top TV Episodes
        </h2>
        <LibraryMenuProvider initialItem={{ label: TOP_TV_EPISODES[0].episode }}>
          <ScrollColumn footer={<EpisodeCounter />}>
            <LibraryMenu items={EPISODE_ITEMS} ariaLabel="Top TV episodes" />
          </ScrollColumn>
        </LibraryMenuProvider>
      </div>
    </div>
  );
}

/** An episode row's icon: the show's own logo, 36 px with a rounded corner, as the row icons elsewhere take their bitmap art (§6.9's `GameArt`). */
function EpisodeArt({ src }: { src: string }) {
  return (
    <Image
      src={asset(src)}
      alt=""
      width={72}
      height={72}
      className="h-9 w-9 shrink-0 rounded-[4px] object-cover"
    />
  );
}

/** The "1 of 50" counter, in the scroll column's footer slot (§6.12). Its denominator is the chart's real size, not this mockup's five rows. */
function EpisodeCounter() {
  const highlighted = useHighlightedItem();
  const index = TOP_TV_EPISODES.findIndex((entry) => entry.episode === highlighted?.label);
  return (
    <p aria-live="polite" className="text-[22px] text-(--blade-ink)">
      {(index === -1 ? 0 : index) + 1} of {TOP_TV_EPISODES_TOTAL}
    </p>
  );
}
