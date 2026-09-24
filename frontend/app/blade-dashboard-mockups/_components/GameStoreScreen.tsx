"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { BladeScreenSurface } from "./BladeBackground";
import { gradientCss, STORE_GRADIENT } from "./blade-gradient";
import { STORE_THEME, themeVars } from "./blade-theme";
import { BladeChromeBand, CONTENT_BAND_SHADOW } from "./BladeChromeBand";
import { ButtonLegendBar } from "./ButtonLegendBar";
import { LibraryMenu, type LibraryMenuItem } from "./LibraryMenu";
import { MediaSlot } from "./MediaSlot";
import { MenuIcon } from "./MenuIcons";
import { getPortalRoot } from "./portal";

/**
 * The Game Store screen, opened by the Marketplace blade's Game Store
 * tile (DESIGN.md §6.19.1) — the second of the four stores to become a
 * real destination, after Spotlight (§6.20). Same full-screen structure
 * as the Games Library (§5.4) in the Marketplace orange: section
 * gradient, unclipped sheen, header and legend bands, the content raised
 * as one slab. It sets `STORE_THEME` on its root, because a full-screen
 * surface portals outside the canvas and would otherwise take the games
 * green (§5.4).
 *
 * Unlike Spotlight, the right column is not a list detail panel: it is
 * two stacked promo tiles, exactly the shape of the promotion beside the
 * Marketplace blade's own menu (§6.19). Both are bitmaps on the console
 * and keep the striped placeholder (§6.7) until art is available. The
 * left column is six raised button tiles (§6.2 `button` layout), the
 * console's own categories of the store: All Games, Xbox LIVE Arcade,
 * Xbox Originals, Game Demos, Themes and Gamer Pictures, and More….
 * Xbox Originals is the one tile with a real destination, the Xbox
 * Originals screen (§6.19.2); the rest launch the same URL as a cover
 * of that screen (`LAUNCH_URL`, as `MyGamesScreen.tsx`'s own), since
 * none has a real one yet. Xbox LIVE Arcade holds the cursor at the
 * open, as it does on the console.
 *
 * The legend has "Marketplace Home" live on Y, as Spotlight's does,
 * unbound to a key because that destination does not exist yet; X is
 * dimmed, as the console's own Game Store shows it with no label.
 */
/** The destination of a launch, as `LAUNCH_URL` of `MyGamesScreen.tsx`. Every inert tile opens the same URL. */
const LAUNCH_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

function launchGame() {
  window.location.assign(LAUNCH_URL);
}

const GAME_STORE_ITEMS: LibraryMenuItem[] = [
  { label: "All Games", icon: <MenuIcon name="allGames" />, onSelect: launchGame },
  { label: "Xbox LIVE Arcade", icon: <MenuIcon name="joystick" />, onSelect: launchGame },
  {
    label: "Xbox Originals",
    icon: <MenuIcon name="xboxOriginals" />,
    screen: "xbox-originals",
  },
  { label: "Game Demos", icon: <MenuIcon name="controller" />, onSelect: launchGame },
  {
    label: "Themes and Gamer Pictures",
    icon: <MenuIcon name="themes" />,
    onSelect: launchGame,
  },
  { label: "More…", icon: <MenuIcon name="folder" />, onSelect: launchGame },
];

/** The same radial orange as the canvas of the Marketplace blade. */
const BACKGROUND = gradientCss(STORE_GRADIENT);

export function GameStoreScreen() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const items = rootRef.current?.querySelectorAll<HTMLElement>(
      "[data-nav-item]:not(:disabled)",
    );
    // Xbox LIVE Arcade, the second tile, holds the cursor at the open,
    // as it does on the console.
    (items?.[1] ?? items?.[0])?.focus();
    return () => opener?.focus();
  }, []);

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Game Store"
      className="fixed inset-0 z-40 flex flex-col text-(--blade-ink) outline-none"
      style={{ background: BACKGROUND, ...themeVars(STORE_THEME) }}
    >
      <BladeScreenSurface gradient={STORE_GRADIENT} />

      <BladeChromeBand
        edge="top"
        className="relative z-0 px-[12%] pt-8 pb-5 md:pt-10 md:pb-6"
      >
        <h1 className="text-3xl text-white [text-shadow:0_1px_2px_rgba(0,0,0,.28)] sm:text-4xl">
          Game Store
        </h1>
      </BladeChromeBand>

      <div
        data-nav-list="column"
        className="relative z-10 grid min-h-0 flex-1 grid-cols-1 gap-8 overflow-y-auto px-[12%] py-6 md:grid-cols-2 md:gap-x-10"
        style={{ boxShadow: CONTENT_BAND_SHADOW }}
      >
        <LibraryMenu
          layout="buttons"
          items={GAME_STORE_ITEMS}
          ariaLabel="Game Store menu"
        />
        <div className="flex min-w-0 flex-col gap-3">
          <MediaSlot label="Overlord: Raising Hell" className="aspect-[16/5]" />
          <MediaSlot label="Maximize Your Xbox LIVE Update!" className="flex-1" />
        </div>
      </div>

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
