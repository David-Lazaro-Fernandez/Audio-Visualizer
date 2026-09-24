"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { ButtonLegendBar } from "./ButtonLegendBar";
import { getPortalRoot } from "./portal";
import { playSound } from "./sounds";
import { asset } from "@/app/_lib/asset-path";
import {
  XBOX_ORIGINALS,
  xboxOriginalCoverUrl,
  xboxOriginalRatingUrl,
  type XboxOriginalGame,
} from "./xbox-originals";

/**
 * The Xbox Originals screen, opened by the Game Store screen's Xbox
 * Originals tile (DESIGN.md §6.19.2). Unlike every other full-screen
 * surface here it is not a Nova OS blade: the reference is the original
 * console's own black-and-green Xbox Originals storefront, so the
 * header and the footer are flat `#000000` bars and the body sits on
 * the `xbox_wallpaper.webp` graphic rather than the section gradient
 * and the water sheet (§3.1). It carries no `BladeTheme`: its ink is
 * literal white and Xbox green (`#8bc93e`, the same green the brand
 * wordmark already uses), not a `--blade-*` variable.
 *
 * A five-wide grid of cover art (`data-nav-list={5}`, §8, which
 * `KeyboardNav` already walks with the arrow keys with no extra
 * handler) sits above the "All Xbox Originals" action bar, a second
 * cursor stop of its own. The highlighted cover, by hover or by focus,
 * is reported to the header at the right: the title, truncated with an
 * ellipsis if it overruns, the launch date, and the ESRB badge. Hover
 * and focus are tracked separately, as the Achievements grid does
 * (`AchievementsScreen.tsx`): a hover previews a cover without moving
 * the keyboard cursor, and clears on `onMouseLeave`; the focused cover
 * is the fallback once the hover clears. A cover, or the action bar,
 * launches the same URL as My Games (`MyGamesScreen.tsx`).
 *
 * The action bar sits outside the grid's own `data-nav-list`, thus a
 * small handler on the content column bridges the two: Down from the
 * grid's last row moves to the bar, and Up from the bar returns to the
 * highlighted cover, exactly as the Achievements screen bridges its
 * game filter and its grid (`onKeyDown` there, §6.10).
 *
 * The row that opened this screen owns Back (`MenuListItem` with
 * `useBackKey`), thus this screen takes no props.
 */
const GRID_COLS = 5;

const WALLPAPER = "/assets/marketplace/xbox_games/xbox_wallpaper.webp";
const LOGO = "/assets/marketplace/xbox_games/original_xbox_logo.webp";

/** DESIGN.md §6.19.2: the hover/focus glow behind a cover. */
const GLOW_COLOR = "#728A1E";

/** The destination of a launch, as `LAUNCH_URL` of `MyGamesScreen.tsx`. Every cover opens the same URL. */
const LAUNCH_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

function launchGame() {
  window.location.assign(LAUNCH_URL);
}

export function XboxOriginalsScreen() {
  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLUListElement>(null);
  const pillRef = useRef<HTMLButtonElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const highlightedIndex = hoveredIndex ?? focusedIndex;
  const game = XBOX_ORIGINALS[highlightedIndex];

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    rootRef.current
      ?.querySelector<HTMLElement>("[data-nav-item]:not(:disabled)")
      ?.focus();
    return () => opener?.focus();
  }, []);

  // Bridge the grid's own `data-nav-list` and the action bar below it,
  // as `AchievementsScreen.tsx` bridges its two adjacent columns:
  // `KeyboardNav` only moves within one `data-nav-list`, so a plain
  // Down at the last row and a plain Up on the bar would do nothing.
  //
  // The bar itself must also swallow Up and Down, and not just Up. It
  // has no `data-nav-list` ancestor, so an unhandled arrow key on it
  // reaches `KeyboardNav`'s own fallback for "no item has focus" —
  // which, with the Game Store screen still mounted underneath this
  // one (§5.4), can focus a covered, invisible item on that screen
  // instead of leaving the bar alone. Swallowing both keys here keeps
  // the cursor on this screen's own two stops.
  const onContentKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (e.key === "ArrowDown" && gridRef.current?.contains(target)) {
      const tiles = Array.from(
        gridRef.current.querySelectorAll<HTMLElement>("[data-nav-item]"),
      );
      const tile = target.closest<HTMLElement>("[data-nav-item]");
      const position = tile ? tiles.indexOf(tile) : -1;
      const lastRowStart =
        Math.floor((tiles.length - 1) / GRID_COLS) * GRID_COLS;
      if (position !== -1 && position >= lastRowStart) {
        e.preventDefault();
        pillRef.current?.focus();
        playSound("select");
      }
      return;
    }
    if (target === pillRef.current && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      if (e.key === "ArrowUp") {
        const tiles = gridRef.current?.querySelectorAll<HTMLElement>("[data-nav-item]");
        (tiles?.[highlightedIndex] ?? tiles?.[0])?.focus();
        playSound("select");
      }
      // Down on the bar: nothing sits below it, so the key is simply
      // swallowed rather than falling through to the global fallback.
    }
  };

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Xbox Originals"
      className="fixed inset-0 z-40 flex flex-col bg-black text-white outline-none"
      style={{
        backgroundImage: `url(${asset(WALLPAPER)})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <header className="relative z-0 flex items-center justify-between gap-6 bg-black px-[6%] py-6">
        <div className="flex min-w-0 items-center gap-4">
          <Image
            src={asset(LOGO)}
            alt=""
            width={200}
            height={200}
            className="h-12 w-12 shrink-0 sm:h-14 sm:w-14"
          />
          <h1
            className="truncate text-3xl sm:text-4xl"
            style={{ color: "#8bc93e" }}
          >
            Xbox Originals
          </h1>
        </div>
        <div aria-live="polite" className="min-w-0 text-right">
          <p className="max-w-[420px] truncate text-2xl leading-tight sm:text-[26px]">
            {game.name}
          </p>
          <div className="mt-1 flex items-center justify-end gap-3">
            <span className="text-lg text-white/70">
              Released on: {game.launchDate}
            </span>
            <Image
              src={asset(xboxOriginalRatingUrl(game.rating))}
              alt={`Rated ${game.rating}`}
              width={60}
              height={80}
              className="h-10 w-auto"
            />
          </div>
        </div>
      </header>

      <div
        onKeyDown={onContentKeyDown}
        className="relative z-10 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-[6%] py-8"
      >
        <ul
          ref={gridRef}
          data-nav-list={GRID_COLS}
          aria-label="Xbox Originals games"
          className="grid grid-cols-[repeat(5,200px)] gap-[100px]"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {XBOX_ORIGINALS.map((entry, index) => (
            <li key={entry.file}>
              <CoverTile
                game={entry}
                selected={index === highlightedIndex}
                onFocus={() => setFocusedIndex(index)}
                onHover={() => setHoveredIndex(index)}
              />
            </li>
          ))}
        </ul>

        {/* The action bar (§6.19.2): the whole catalogue has only this
            one category, so unlike the Music Library's category rows
            it filters nothing — it is a plain cursor stop that launches
            the same URL as a cover. */}
        <button
          ref={pillRef}
          type="button"
          data-nav-item
          onClick={() => {
            playSound("selectA");
            launchGame();
          }}
          className="mt-2 flex items-center rounded-[10px] border border-white/35 bg-black/45 px-6 py-3 text-left transition-[box-shadow,border-color] duration-150 hover:border-[rgba(217,255,150,.9)] hover:shadow-[0_0_24px_6px_#728A1E] focus:border-[rgba(217,255,150,.9)] focus:shadow-[0_0_24px_6px_#728A1E] focus:outline-none"
        >
          <span className="text-lg text-white/90">All Xbox Originals</span>
        </button>
      </div>

      <footer className="relative z-0 bg-black px-[6%] py-6">
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
      </footer>
    </div>,
    getPortalRoot(),
  );
}

/**
 * One cover (DESIGN.md §6.19.2): a thin dark green border at rest. The
 * highlighted cover, by hover or by focus, grows slightly and takes a
 * soft glow in `GLOW_COLOR` with a lighter frame, as the reference
 * screenshot's focused item does.
 */
function CoverTile({
  game,
  selected,
  onFocus,
  onHover,
}: {
  game: XboxOriginalGame;
  selected: boolean;
  onFocus: () => void;
  onHover: () => void;
}) {
  return (
    <button
      type="button"
      data-nav-item
      aria-label={`${game.name}, rated ${game.rating}, released ${game.launchDate}`}
      onFocus={onFocus}
      onMouseEnter={() => {
        playSound("select");
        onHover();
      }}
      onClick={() => {
        playSound("selectA");
        launchGame();
      }}
      className="relative block aspect-[7/10] w-full overflow-hidden rounded-[6px] border transition-[transform,box-shadow,border-color] duration-150 ease-out focus:outline-none"
      style={{
        borderColor: selected ? "rgba(217,255,150,.9)" : "rgba(60,90,20,.8)",
        transform: selected ? "scale(1.08)" : "scale(1)",
        boxShadow: selected ? `0 0 24px 6px ${GLOW_COLOR}` : "none",
      }}
    >
      <Image
        src={asset(xboxOriginalCoverUrl(game.file))}
        alt={game.name}
        fill
        sizes="200px"
        className="object-cover"
      />
    </button>
  );
}
