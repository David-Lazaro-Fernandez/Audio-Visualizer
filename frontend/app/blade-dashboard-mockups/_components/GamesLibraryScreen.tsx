"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { BladeScreenSurface } from "./BladeBackground";
import { gradientCss, GAMES_GRADIENT } from "./blade-gradient";
import { BladeChromeBand, CONTENT_BAND_SHADOW } from "./BladeChromeBand";
import { ButtonLegendBar } from "./ButtonLegendBar";
import {
  LibraryMenu,
  LibraryMenuDescription,
  LibraryMenuProvider,
  type LibraryMenuItem,
} from "./LibraryMenu";
import { MenuIcon } from "./MenuIcons";
import { getPortalRoot } from "./portal";
import { XboxLiveBanner } from "./XboxLiveBanner";

/**
 * The "Games Library" screen the Games blade's Played Games row opens.
 * Full-screen on the same green and concentric wave sheen as the blade
 * (BladeScreenSurface, unclipped); darker header/legend bands top and bottom;
 * two columns in between — a stack of raised buttons on the left topped by
 * the Xbox LIVE banner, and a borderless description pane on the right
 * that follows the cursor (title + one or two sentences).
 *
 * State is shown through contrast only: the highlighted row goes
 * near-white, live rows are mid-green, disabled rows keep their shape but
 * drop to low-contrast green (§7.2). The legend is Y/X unbound on the
 * left, Back B / Select A on the right.
 *
 * Keyboard: its own `data-nav-list` column so Up/Down step the rows;
 * `aria-modal` keeps Left/Right from flipping blades underneath. Focus
 * moves to the first live row on open and back to the opener on close.
 * The Back key itself is handled by the row that opened this screen
 * (`MenuListItem`), which owns the open state and plays the Back sound —
 * which is why this screen takes no props (it satisfies `MenuScreenProps`
 * by simply ignoring `onClose`).
 */
const GAMES_LIBRARY_ITEMS: LibraryMenuItem[] = [
  {
    label: "My Games",
    meta: "8",
    icon: <MenuIcon name="controller" />,
    description:
      "You have 8 games on your console. Select this option to play your games now.",
    screen: "my-games",
  },
  {
    label: "Last Played Game",
    disabled: true,
    icon: <MenuIcon name="controller" />,
    description: "Jump back into the game you played most recently.",
  },
  {
    label: "Friends Playing Now",
    disabled: true,
    icon: <MenuIcon name="controller" />,
    description: "See which games your friends are playing right now.",
  },
  {
    label: "Game Store",
    icon: <MenuIcon name="controller" />,
    description:
      "Browse and download games, demos, and add-ons from Xbox LIVE Marketplace.",
  },
  {
    label: "Auto Downloads",
    meta: "Off",
    icon: <MenuIcon name="controller" />,
    description:
      "Automatically download content you've queued from Xbox.com while your console is on.",
  },
];

/** Same radial green as the Games blade canvas. */
const BACKGROUND = gradientCss(GAMES_GRADIENT);


export function GamesLibraryScreen() {
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
      aria-label="Games Library"
      className="fixed inset-0 z-40 flex flex-col text-[#17300a]"
      style={{ background: BACKGROUND }}
    >
      <BladeScreenSurface gradient={GAMES_GRADIENT} />

      {/* Header and legend sit at z-0, beneath the content band's shadow. */}
      <BladeChromeBand
        edge="top"
        className="relative z-0 px-[12%] pt-8 pb-5 md:pt-10 md:pb-6"
      >
        <h1 className="text-3xl text-white [text-shadow:0_1px_2px_rgba(0,0,0,.28)] sm:text-4xl">
          Games Library
        </h1>
      </BladeChromeBand>

      <LibraryMenuProvider initialItem={GAMES_LIBRARY_ITEMS[0]}>
        <div
          data-nav-list="column"
          className="relative z-10 grid min-h-0 flex-1 grid-cols-1 gap-8 overflow-y-auto px-[12%] py-6 md:grid-cols-[minmax(0,38%)_1fr] md:gap-12"
          style={{ boxShadow: CONTENT_BAND_SHADOW }}
        >
          <div className="flex min-w-0 flex-col gap-3">
            <XboxLiveBanner />
            <LibraryMenu
              layout="buttons"
              items={GAMES_LIBRARY_ITEMS}
              ariaLabel="Games Library menu"
            />
          </div>
          <LibraryMenuDescription
            showTitle
            titleClassName="mb-1 text-[30px] leading-tight"
            className="max-w-[560px] pt-2 text-pretty text-[24px] leading-snug sm:text-[26px]"
          />
        </div>
      </LibraryMenuProvider>

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
