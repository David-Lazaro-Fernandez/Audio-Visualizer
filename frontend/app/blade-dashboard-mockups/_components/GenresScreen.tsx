"use client";

import { useEffect, useRef } from "react";
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
import { getPortalRoot } from "./portal";
import { ScrollColumn } from "./ScrollColumn";
import { TV_GENRES } from "./genres";

/**
 * The Genres screen, opened by the TV Shows screen's Genres tile
 * (DESIGN.md §6.19.4). Same full-screen structure as the Games Library
 * (§5.4) in the Marketplace orange: section gradient, unclipped sheen,
 * header and legend bands, the content raised as one slab. It sets
 * `STORE_THEME` on its root, as the other Marketplace screens do
 * (§5.4).
 *
 * The body is one full-width column, unlike the two-column screens
 * elsewhere on this blade: a single scrolling list (`ScrollColumn`) of
 * the blade's own divider rows (§6.2 `row`), each with no icon
 * (`icon={null}`), since the console drew this list as plain text.
 * "All Genres" leads the list, as "All Games" leads the Achievements
 * screen and My Games (§6.9, §6.10). None has a destination yet, so
 * every row launches the same URL as a cover of the Xbox Originals
 * screen (`LAUNCH_URL`, as `MyGamesScreen.tsx`'s own). A "N of 15"
 * counter follows the cursor in the scroll column's own footer slot.
 *
 * Legend: Y "Marketplace Home" is live but unbound, the same
 * live-but-unbound kind of slot as the Game Store's own Y (§6.19.1); X
 * is dimmed, Back is B, Select is A.
 */
/** The destination of a launch, as `LAUNCH_URL` of `MyGamesScreen.tsx`. Every row opens the same URL. */
const LAUNCH_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

function launchRickroll() {
  window.location.assign(LAUNCH_URL);
}

const GENRE_ITEMS: LibraryMenuItem[] = TV_GENRES.map((label) => ({
  label,
  icon: null,
  onSelect: launchRickroll,
}));

/** The same radial orange as the canvas of the Marketplace blade. */
const BACKGROUND = gradientCss(STORE_GRADIENT);

export function GenresScreen() {
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
      aria-label="Genres"
      className="fixed inset-0 z-40 flex flex-col text-(--blade-ink) outline-none"
      style={{ background: BACKGROUND, ...themeVars(STORE_THEME) }}
    >
      <BladeScreenSurface gradient={STORE_GRADIENT} />

      <BladeChromeBand
        edge="top"
        className="relative z-0 px-[12%] pt-8 pb-5 md:pt-10 md:pb-6"
      >
        <h1 className="text-3xl text-white [text-shadow:0_1px_2px_rgba(0,0,0,.28)] sm:text-4xl">
          Genres
        </h1>
      </BladeChromeBand>

      <LibraryMenuProvider initialItem={{ label: GENRE_ITEMS[0].label }}>
        <div
          data-nav-list="column"
          className="relative z-10 flex min-h-0 flex-1 flex-col px-[12%] py-6"
          style={{ boxShadow: CONTENT_BAND_SHADOW }}
        >
          <ScrollColumn footer={<GenreCounter />}>
            <LibraryMenu items={GENRE_ITEMS} ariaLabel="Genres" />
          </ScrollColumn>
        </div>
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

/** The "N of 15" counter, in the scroll column's footer slot (§6.12). */
function GenreCounter() {
  const highlighted = useHighlightedItem();
  const index = TV_GENRES.findIndex((genre) => genre === highlighted?.label);
  return (
    <p aria-live="polite" className="text-[22px] text-(--blade-ink)">
      {(index === -1 ? 0 : index) + 1} of {TV_GENRES.length}
    </p>
  );
}
