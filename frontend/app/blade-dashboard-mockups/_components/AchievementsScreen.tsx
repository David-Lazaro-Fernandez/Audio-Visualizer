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
import { asset } from "@/app/_lib/asset-path";

/**
 * The Achievements screen, which the Achievements row of the Games blade
 * opens (DESIGN.md §6.10). It has the same skin as the Games Library:
 * the section green with the wave sheen and no clip, darker header and
 * legend bands, the content between them as one raised slab, and 12%
 * side padding.
 *
 * There are three parts, in a 2x2 grid with an empty top-left cell:
 *
 * - The summary, at the top right: a raised readout with the name of
 *   the highlighted title, the count of achievements and the earned and
 *   total Gamerscore. It follows the cursor through the shared highlight
 *   provider. It is not a control.
 * - The game filter, on the left: a column of blade rows with an icon
 *   only (`LibraryMenu` with `iconOnly`). "All Games" is first, then the
 *   art of each title. A hover or a focus on a row filters the grid
 *   again, as on the console. Select, by A or a click, or Right moves
 *   the cursor into the grid.
 * - The achievement grid, on the right: six tiles across. On a title, an
 *   unlocked achievement shows its art and a locked achievement shows
 *   the trophy-under-padlock glyph. "All Games" lists only the unlocked
 *   achievements of each title. Left from the first column of the grid
 *   returns to the row that filtered the grid. Select on a tile plays
 *   Select A only, because the achievement detail screen does not exist
 *   yet.
 *
 * Both columns scroll behind a hidden scrollbar and show the small
 * down-arrow of the console while there is more content below
 * (`ScrollColumn`).
 *
 * The title tiles and the achievement icons are full-colour bitmaps from
 * `public/assets/` (`achievements.ts`) and are not redrawn in the
 * menu-icon finish (§6.2). The screen lists an achievement only with its
 * art, thus a title with no art shows an empty grid. A title tile with
 * no art falls back to the placeholder stripes (`MediaSlot`). The row
 * that opened this screen owns Back (`MenuListItem` with `useBackKey`),
 * thus this screen takes no props.
 */
const GRID_COLS = 6;

/** The same radial green as the canvas of the Games blade. */
const BACKGROUND = gradientCss(GAMES_GRADIENT);

/** "All Games" is first, then one row for each title. */
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

      {/* The header and the legend are at z-0, below the shadow of the content band. */}
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
 * The summary, the game filter and the grid. This component is inside
 * `LibraryMenuProvider`, thus the highlighted row, by a hover or a
 * focus, selects the title on the screen.
 *
 * This component moves the cursor between the two columns, before
 * `KeyboardNav` reads the key, because that handler ignores a prevented
 * event. Right from a game row goes to the first tile of the grid. Left
 * from a tile in the first column of the grid returns to the row of the
 * current title. `KeyboardNav` handles Up and Down in each column, with
 * `data-nav-list="column"` on the rows and `data-nav-list="6"` on the
 * grid.
 *
 * Art that does not load hides its item and does not leave a broken
 * tile. Each `<Image>` calls `onImageFetchFailed` when its request
 * fails or returns an empty body, which is a natural size of zero. The
 * code keeps that source in `failedImages`, and `visibleGames` removes
 * each achievement, and each title row, whose art is in that list. The
 * counts in the summary follow, because they read the same filtered
 * lists.
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

  // The achievement under the cursor in the grid, if there is one. The
  // summary then shows it in place of the totals of the title. The code
  // tracks the hover and the focus separately, thus the mouse can show a
  // tile and the keyboard cursor keeps its selection. Both clear when
  // the cursor leaves the grid or the title changes.
  const [focusedAchievement, setFocusedAchievement] = useState<Achievement | null>(null);
  const [hoveredAchievement, setHoveredAchievement] = useState<Achievement | null>(null);
  useEffect(() => {
    setFocusedAchievement(null);
    setHoveredAchievement(null);
  }, [game.title]);

  const listRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // The cursor goes to the first game row at the open and returns to the
  // row that opened the screen at the close.
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
    // Select on a row confirms the filter and moves the cursor into the
    // grid. `MenuListItem` plays Select A.
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
        {/* Keyed by title, thus a change remounts the grid and removes the
            old cursor. Without the key the focus could stay on a tile
            that no longer exists. */}
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
 * The raised readout above the grid. With the cursor in the title
 * column, it shows the title, the count of achievements and the earned
 * and total Gamerscore with the "G" badge. With the cursor on a tile, it
 * shows that achievement: its name, how to earn it and its Gamerscore.
 * The console changed the box in the same way. It has the same skin as
 * the My Games detail panel (§6.9): the border and the bevel of the
 * raised button on a translucent lighter green. It has no hover state
 * and no focus state, because it is not a cursor stop. The description
 * can use two lines, and the other parts of the box keep their shape.
 */
function AchievementSummary({
  game,
  achievement,
}: {
  game: AchievementGame;
  /** The achievement under the cursor, or null to show the totals of the title. */
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
        {/* Row 2: the description on the left, then the Gamerscore and its badge as two columns on the right. */}
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
      {/* Row 2: the count on the left, then the Gamerscore and its badge as two columns on the right. */}
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
 * Six achievement tiles across (§6.10). Each tile is a cursor stop with
 * the raised skin. An unlocked tile holds the art and a locked tile
 * holds the trophy-under-padlock glyph (`MenuIcon` "lockedTrophy"). With
 * `unlockedOnly`, which is the "All Games" view, the grid omits the
 * locked achievements. Thus the folded grid is the trophy case of the
 * gamer and not the catalogue. The cursor is the same pale grey wash as
 * on the rows, and it fades in across 150 ms.
 *
 * The component reports the achievement under the cursor to the summary
 * box. It clears the focus on the list only when the focus leaves the
 * list (`relatedTarget` is outside), thus a move from tile to tile does
 * not show the totals of the title between the two tiles. It clears the
 * hover when the mouse leaves the list.
 */
function AchievementGrid({
  game,
  unlockedOnly = false,
  onImageFetchFailed,
  onFocusChange,
  onHoverChange,
}: {
  game: AchievementGame;
  /** List only the unlocked achievements. This is the "All Games" view. */
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

/** The art of a title in the game filter column, 88 px square, as the "All Games" glyph beside it. */
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

/** Called with the `src` of an image whose request failed or returned no pixels. */
type ImageFetchFailedHandler = (src: string) => void;

/**
 * The titles and the achievements whose art loaded. A title row goes
 * with its art. The code filters the achievements in each title, which
 * also covers the folded "All Games" list, because that list uses the
 * same entries.
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
 * The bitmap art, if there is art. If there is none, the striped
 * placeholder of the blade (`MediaSlot`, §6.7) with a short monospace
 * watermark. An achievement always has art (refer to
 * `Achievement.image`), thus the fallback is for a title tile.
 *
 * The component reports a request that fails, and a request that
 * succeeds with an empty body, which the browser gives as an image of
 * size zero. It reports through `onImageFetchFailed`, thus the owner can
 * remove the item and does not show a broken tile.
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
        src={asset(image)}
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

/** Watermark text for an 88 px tile: the first word, in lower case. */
function shortLabel(label: string) {
  return label.split(/[\s:]+/)[0].toLowerCase();
}

