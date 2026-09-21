"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  ACHIEVEMENT_GAMES,
  ALL_GAMES_TITLE,
  achievementTotals,
  allGames,
  type Achievement,
  type AchievementGame,
} from "./achievements";
import { BladeScreenSurface } from "./BladeBackground";
import { gradientCss, GAMES_GRADIENT } from "./blade-gradient";
import { BladeChromeBand, CONTENT_BAND_SHADOW } from "./BladeChromeBand";
import { ButtonLegendBar } from "./ButtonLegendBar";
import { LetterBadge } from "./LetterBadge";
import {
  LibraryMenu,
  LibraryMenuProvider,
  useHighlightedItem,
  type LibraryMenuItem,
} from "./LibraryMenu";
import { MediaSlot } from "./MediaSlot";
import { MenuIcon } from "./MenuIcons";
import { RAISED_BORDER, RAISED_INSET_SHADOW } from "./MenuListItem";
import { getPortalRoot } from "./portal";
import { ScrollColumn } from "./ScrollColumn";
import { playSound } from "./sounds";

/**
 * The "Achievements" screen the Games blade's Achievements row opens
 * (DESIGN.md §6.10). Same skin as the Games Library: the section green
 * with the unclipped wave sheen, darker header and legend bands, the
 * content between them raised as one slab, 12% side padding.
 *
 * Three parts, laid out as a 2×2 grid with the top-left cell empty:
 *
 * - **Summary** (top right): a raised readout — the highlighted title's
 *   name, "N achievements" and the earned / total Gamerscore. It follows
 *   the cursor through the shared highlight provider; it is not a control.
 * - **Game filter** (left): a column of icon-only blade rows (`LibraryMenu`
 *   with `iconOnly`) — "All Games" first, then each title's art. Hover or
 *   focus on a row refilters the grid, as the console does; Select (A,
 *   click) or Right moves the cursor into the grid.
 * - **Achievement grid** (right): six tiles across. On a title, unlocked
 *   achievements show their art and locked ones the trophy-under-padlock
 *   glyph; "All Games" lists only what has been unlocked, across every
 *   title. Left from the grid's first column returns to the row that
 *   filtered it. Selecting a tile only
 *   plays Select A for now — the achievement detail screen isn't built.
 *
 * Both columns scroll behind a hidden scrollbar and show the console's
 * small down-arrow while there is more below (`ScrollColumn`).
 *
 * Title tiles and achievement icons are full-colour bitmaps from
 * `public/assets/` (`achievements.ts`), not redrawn in the menu-icon finish
 * (§6.2). Achievements are only listed with their art; a title without any
 * shows an empty grid. A title tile without art falls back to placeholder
 * stripes (`MediaSlot`). Back is owned by the row that opened this screen
 * (`MenuListItem` + `useBackKey`), so it takes no props.
 */
const GRID_COLS = 6;

/** Same radial green as the Games blade canvas. */
const BACKGROUND = gradientCss(GAMES_GRADIENT);

/** "All Games" leads, then one row per title. */
const GAMES: AchievementGame[] = [allGames(ACHIEVEMENT_GAMES), ...ACHIEVEMENT_GAMES];

export function AchievementsScreen() {
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Achievements"
      className="fixed inset-0 z-40 flex flex-col text-(--blade-ink)"
      style={{ background: BACKGROUND }}
    >
      <BladeScreenSurface gradient={GAMES_GRADIENT} />

      {/* Header and legend sit at z-0, beneath the content band's shadow. */}
      <BladeChromeBand
        edge="top"
        className="relative z-0 px-[12%] pt-8 pb-5 md:pt-10 md:pb-6"
      >
        <h1 className="text-3xl text-white [text-shadow:0_1px_2px_rgba(0,0,0,.28)] sm:text-4xl">
          Achievements
        </h1>
      </BladeChromeBand>

      <LibraryMenuProvider initialItem={{ label: GAMES[0].title }}>
        <AchievementsBody games={GAMES} />
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

/**
 * Summary, game filter and grid. Lives inside `LibraryMenuProvider` so the
 * highlighted row (hover or focus) picks the title shown.
 *
 * Cursor travel between the two columns is handled here, before
 * `KeyboardNav` sees the key (it skips prevented events): Right from a game
 * row lands on the grid's first tile; Left from a tile in the grid's first
 * column goes back to the row for the current title. Up/Down inside each
 * column are `KeyboardNav`'s own (`data-nav-list="column"` on the rows,
 * `data-nav-list="6"` on the grid).
 *
 * Broken art hides its item rather than leaving a broken tile: every
 * `<Image>` reports through `onImageFetchFailed` when its request errors
 * or comes back empty (zero natural size), the source is remembered in
 * `failedImages`, and `visibleGames` drops any achievement — and any title
 * row — whose art is on that list. The summary counts follow, since they
 * read the same filtered lists.
 */
function AchievementsBody({ games: allTitles }: { games: AchievementGame[] }) {
  const [failedImages, setFailedImages] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const onImageFetchFailed = useCallback((src: string) => {
    setFailedImages((prev) => {
      if (prev.has(src)) return prev;
      const next = new Set(prev);
      next.add(src);
      return next;
    });
  }, []);

  const games = useMemo(
    () => withoutFailedArt(allTitles, failedImages),
    [allTitles, failedImages],
  );

  const highlighted = useHighlightedItem();
  const index = Math.max(
    0,
    games.findIndex((game) => game.title === highlighted?.label),
  );
  const game = games[index];

  // The achievement under the cursor in the grid, if any: the summary shows
  // it instead of the title's totals. Hover and focus are tracked apart so
  // the mouse can preview a tile without losing the keyboard cursor's pick,
  // and both clear when the cursor leaves the grid or the title changes.
  const [focusedAchievement, setFocusedAchievement] = useState<Achievement | null>(null);
  const [hoveredAchievement, setHoveredAchievement] = useState<Achievement | null>(null);
  useEffect(() => {
    setFocusedAchievement(null);
    setHoveredAchievement(null);
  }, [game.title]);

  const listRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Cursor handoff: land on the first game row on open, hand focus back to
  // the opener on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    listRef.current
      ?.querySelector<HTMLElement>("[data-nav-item]:not(:disabled)")
      ?.focus();
    return () => opener?.focus();
  }, []);

  const focusFirstTile = () => {
    const tile = gridRef.current?.querySelector<HTMLElement>("[data-nav-item]");
    if (!tile) return;
    tile.focus();
  };

  const focusGameRow = () => {
    const rows = listRef.current?.querySelectorAll<HTMLElement>("[data-nav-item]");
    const row = rows?.[index];
    if (!row) return;
    row.focus();
    playSound("select");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (e.key === "ArrowRight" && listRef.current?.contains(target)) {
      e.preventDefault();
      if (gridRef.current?.querySelector("[data-nav-item]")) {
        focusFirstTile();
        playSound("select");
      }
      return;
    }
    if (e.key === "ArrowLeft" && gridRef.current?.contains(target)) {
      const tiles = Array.from(
        gridRef.current.querySelectorAll<HTMLElement>("[data-nav-item]"),
      );
      const tile = target.closest<HTMLElement>("[data-nav-item]");
      const position = tile ? tiles.indexOf(tile) : -1;
      if (position !== -1 && position % GRID_COLS === 0) {
        e.preventDefault();
        focusGameRow();
      }
    }
  };

  const items: LibraryMenuItem[] = games.map((entry, i) => ({
    label: entry.title,
    icon:
      i === 0 ? (
        <MenuIcon name="allGames" className="h-22 w-22" />
      ) : (
        <GameTile game={entry} onImageFetchFailed={onImageFetchFailed} />
      ),
    // Select on a row commits the filter and moves the cursor into the grid
    // (`MenuListItem` plays Select A).
    onSelect: focusFirstTile,
  }));

  return (
    <div
      onKeyDown={onKeyDown}
      className="relative z-10 grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_auto_minmax(0,1fr)] gap-x-10 gap-y-4 px-[12%] pt-6 pb-3 md:grid-cols-[minmax(0,17%)_1fr] md:grid-rows-[auto_minmax(0,1fr)]"
      style={{ boxShadow: CONTENT_BAND_SHADOW }}
    >
      <AchievementSummary
        game={game}
        achievement={hoveredAchievement ?? focusedAchievement}
      />

      <div
        ref={listRef}
        data-nav-list="column"
        className="flex min-h-0 flex-col md:col-start-1 md:row-start-2"
      >
        <ScrollColumn>
          <LibraryMenu iconOnly items={items} ariaLabel="Games with achievements" />
        </ScrollColumn>
      </div>

      <div ref={gridRef} className="flex min-h-0 flex-col md:col-start-2 md:row-start-2">
        {/* Keyed by title so a switch remounts the grid and drops any stale
            cursor rather than leaving focus on a tile that no longer exists. */}
        <ScrollColumn key={game.title}>
          <AchievementGrid
            game={game}
            unlockedOnly={game.title === ALL_GAMES_TITLE}
            onImageFetchFailed={onImageFetchFailed}
            onFocusChange={setFocusedAchievement}
            onHoverChange={setHoveredAchievement}
          />
        </ScrollColumn>
      </div>
    </div>
  );
}

/**
 * The raised readout above the grid. With the cursor in the title column it
 * shows the title, "N achievements" and the earned / total Gamerscore with
 * the "G" badge; with the cursor on a tile it shows that achievement
 * instead — name, how to earn it, and the Gamerscore it is worth (the
 * console swaps the box the same way). Same skin as the My Games detail
 * panel (§6.9): the raised button's border and bevel on a translucent
 * lighter green, no hover or focus — it is not a cursor stop. The
 * description may run to two lines; the rest of the box keeps its shape.
 */
function AchievementSummary({
  game,
  achievement,
}: {
  game: AchievementGame;
  /** The achievement under the cursor, or null for the title's totals. */
  achievement: Achievement | null;
}) {
  const skin = `rounded-[10px] px-5 py-3 text-[24px] leading-snug md:col-start-2 md:row-start-1 ${RAISED_BORDER} ${RAISED_INSET_SHADOW}`;
  const background = { background: "rgba(255,255,255,.12)" };

  if (achievement) {
    return (
      <section
        aria-live="polite"
        aria-label={`${achievement.name} details`}
        className={skin}
        style={background}
      >
        {/* Row 1: the name. */}
        <p className="truncate">
          {achievement.name}
          {!achievement.unlocked && <span className="text-(--blade-ink-soft)"> — Locked</span>}
        </p>
        {/* Row 2: description on the left; Gamerscore and its badge as two columns on the right. */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6">
          <p className="line-clamp-2 text-pretty">{achievement.description}</p>
          <div className="grid grid-cols-[auto_auto] items-center gap-x-1">
            <p className="tabular-nums">{achievement.score}</p>
            <LetterBadge>G</LetterBadge>
          </div>
        </div>
      </section>
    );
  }

  const { count, earned, total } = achievementTotals(game);
  return (
    <section
      aria-live="polite"
      aria-label={`${game.title} summary`}
      className={skin}
      style={background}
    >
      {/* Row 1: the title. */}
      <p className="truncate">{game.title}</p>
      {/* Row 2: count on the left; Gamerscore and its badge as two columns on the right. */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6">
        <p className="truncate">
          {count} {count === 1 ? "achievement" : "achievements"}
        </p>
        <div className="grid grid-cols-[auto_auto] items-center gap-x-1">
          <p className="tabular-nums">
            {earned} / {total}
          </p>
          <LetterBadge>G</LetterBadge>
        </div>
      </div>
    </section>
  );
}

/**
 * Six achievement tiles across (§6.10). Every tile is a cursor stop with the
 * raised skin; unlocked ones hold the art, locked ones the trophy-under-
 * padlock glyph (`MenuIcon` "lockedTrophy"). With `unlockedOnly` (the
 * "All Games" view) locked ones are left out altogether, so the folded
 * grid is the gamer's trophy case rather than the catalogue. The cursor is
 * the same pale grey wash as the rows, faded in over 150 ms.
 *
 * Reports the achievement under the cursor for the summary box: focus is
 * cleared on the list itself only when focus leaves it altogether
 * (`relatedTarget` outside), so stepping tile to tile never flashes the
 * title totals in between; hover is cleared when the mouse leaves the list.
 */
function AchievementGrid({
  game,
  unlockedOnly = false,
  onImageFetchFailed,
  onFocusChange,
  onHoverChange,
}: {
  game: AchievementGame;
  /** List only unlocked achievements (the "All Games" view). */
  unlockedOnly?: boolean;
  onImageFetchFailed: ImageFetchFailedHandler;
  onFocusChange: (achievement: Achievement | null) => void;
  onHoverChange: (achievement: Achievement | null) => void;
}) {
  const shown = unlockedOnly
    ? game.achievements.filter((a) => a.unlocked)
    : game.achievements;
  return (
    <ul
      data-nav-list={GRID_COLS}
      aria-label={`${game.title} achievements`}
      className="grid grid-cols-6 gap-x-8 gap-y-7 px-1 pt-1 pb-2"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onFocusChange(null);
      }}
      onMouseLeave={() => onHoverChange(null)}
    >
      {shown.map((achievement, i) => (
        <li key={`${achievement.name}-${i}`}>
          <AchievementTile
            achievement={achievement}
            onImageFetchFailed={onImageFetchFailed}
            onFocus={() => onFocusChange(achievement)}
            onHover={() => onHoverChange(achievement)}
          />
        </li>
      ))}
    </ul>
  );
}

function AchievementTile({
  achievement,
  onImageFetchFailed,
  onFocus,
  onHover,
}: {
  achievement: Achievement;
  onImageFetchFailed: ImageFetchFailedHandler;
  onFocus: () => void;
  onHover: () => void;
}) {
  const label = [
    `${achievement.name}, ${achievement.score}G${achievement.unlocked ? "" : ", locked"}`,
    achievement.description,
  ]
    .filter(Boolean)
    .join(". ");
  return (
    <button
      type="button"
      data-nav-item
      aria-label={label}
      onFocus={onFocus}
      onMouseEnter={() => {
        playSound("select");
        onHover();
      }}
      onClick={() => playSound("selectA")}
      className={`flex aspect-square w-full items-center justify-center rounded-[10px] bg-[rgba(255,255,255,.08)] p-3 transition-colors duration-150 hover:bg-[rgba(217,217,217,.55)] focus:bg-[rgba(217,217,217,.55)] focus:outline-none ${RAISED_BORDER} ${RAISED_INSET_SHADOW}`}
    >
      {achievement.unlocked ? (
        <Art
          image={achievement.image}
          label={achievement.name}
          className="h-full"
          onImageFetchFailed={onImageFetchFailed}
        />
      ) : (
        <MenuIcon name="lockedTrophy" className="h-3/4 w-3/4" />
      )}
    </button>
  );
}

/** A title's art in the game filter column, 88 px square like the "All Games" glyph beside it. */
function GameTile({
  game,
  onImageFetchFailed,
}: {
  game: AchievementGame;
  onImageFetchFailed: ImageFetchFailedHandler;
}) {
  return (
    <span className="block h-22 w-22">
      <Art
        image={game.image}
        label={game.title}
        className="h-full"
        onImageFetchFailed={onImageFetchFailed}
      />
    </span>
  );
}

/** Called with the `src` of an image whose fetch errored or returned no pixels. */
type ImageFetchFailedHandler = (src: string) => void;

/**
 * The titles and achievements whose art has not failed to load. Title rows
 * go with their art; achievements are filtered inside every title, which
 * covers the folded "All Games" list too since it shares the same entries.
 */
function withoutFailedArt(
  games: AchievementGame[],
  failed: ReadonlySet<string>,
): AchievementGame[] {
  if (failed.size === 0) return games;
  return games
    .filter((game) => !game.image || !failed.has(game.image))
    .map((game) => ({
      ...game,
      achievements: game.achievements.filter((a) => !failed.has(a.image)),
    }));
}

/**
 * Bitmap art if provided, else the blade's striped placeholder
 * (`MediaSlot`, §6.7) with a short monospace watermark. Achievements always
 * have art (see `Achievement.image`); the fallback is for title tiles.
 *
 * A request that errors, or one that succeeds with an empty body (the
 * browser reports it as a zero-size image), is reported through
 * `onImageFetchFailed` so the owner can drop the item instead of showing a
 * broken tile.
 */
function Art({
  image,
  label,
  className,
  onImageFetchFailed,
}: {
  image?: string;
  label: string;
  className?: string;
  onImageFetchFailed?: ImageFetchFailedHandler;
}) {
  if (!image) {
    return <MediaSlot label={shortLabel(label)} className={`aspect-square ${className ?? ""}`} />;
  }
  return (
    <span className={`relative block aspect-square ${className ?? ""}`}>
      <Image
        src={image}
        alt=""
        fill
        sizes="96px"
        className="rounded-[6px] object-cover"
        onError={() => onImageFetchFailed?.(image)}
        onLoad={(e) => {
          if (e.currentTarget.naturalWidth === 0) onImageFetchFailed?.(image);
        }}
      />
    </span>
  );
}

/** Watermark text that fits an 88 px tile: the first word, lower-cased. */
function shortLabel(label: string) {
  return label.split(/[\s:]+/)[0].toLowerCase();
}

