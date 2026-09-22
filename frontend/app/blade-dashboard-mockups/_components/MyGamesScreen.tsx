"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { BladeScreenSurface } from "./BladeBackground";
import { gradientCss, GAMES_GRADIENT } from "./blade-gradient";
import { BladeChromeBand, CONTENT_BAND_SHADOW } from "./BladeChromeBand";
import { ButtonLegendBar } from "./ButtonLegendBar";
import {
  LibraryMenu,
  LibraryMenuProvider,
  useHighlightedItem,
  type LibraryMenuItem,
} from "./LibraryMenu";
import { isSelectKey } from "./keys";
import { RAISED_BORDER, RAISED_INSET_SHADOW } from "./MenuListItem";
import { getPortalRoot } from "./portal";
import { playSound } from "./sounds";

/**
 * The My Games screen, which the My Games row of the Games Library
 * opens. It is the third surface in the stack: Games blade, Games
 * Library, this screen. It has the same skin as the Games Library: the
 * section green with the wave sheen and no clip, darker header and
 * legend bands, and 12% side padding.
 *
 * A tab strip (§5.5) is between the header and the content: Arcade,
 * Demos, Recently Downloaded and Recently Played. It filters the list.
 * Left and Right step through the enabled tabs, because the console used
 * the bumpers and the arrows have no other work under a modal. A click
 * on a tab also works. A change of tab remounts the list through `key`,
 * thus the cursor goes to the first row of the new list.
 *
 * The list on the left uses the divider-separated rows of the Games
 * blade (`LibraryMenu` in its default `rows` layout), with the artwork
 * of each title from `public/assets/games_pics`. The "N of M" counter
 * below it follows the cursor. The detail panel on the right (§6.9) also
 * follows the cursor, through the same highlight provider as the
 * description pane.
 *
 * The legend is Y Download Games and X unbound on the left, and Back B
 * and Select A on the right. Select, by Enter, Space or A, confirms the
 * highlighted game. Refer to `GamesGrid`. The row that opened this
 * screen owns Back (`MenuListItem` with `useBackKey`), thus this screen
 * takes no props.
 */
type TabKey = "all" | "arcade" | "demos" | "recent-downloads" | "recent-played";

interface MyGamesTab {
  key: TabKey;
  label: string;
  disabled?: boolean;
}

// "All Games" is first, as on the console, thus a full game also has a
// position beside the Arcade downloads and the Demo downloads.
const TABS: MyGamesTab[] = [
  { key: "all", label: "All Games" },
  { key: "arcade", label: "Arcade" },
  { key: "demos", label: "Demos" },
  { key: "recent-downloads", label: "Recently Downloaded" },
  { key: "recent-played", label: "Recently Played", disabled: true },
];

/**
 * The kind of title. It selects the filter tab that lists the title,
 * where Arcade uses `arcade` and Demos uses `demo`. It also selects the
 * header, the status lines and the Achievements text of the detail
 * panel. Refer to `KIND_COPY`.
 */
type GameType = "full_game" | "demo" | "arcade";

interface MyGame {
  title: string;
  /** The title artwork, under `public/assets/games_pics/`. */
  image: string;
  /** One line of text. The detail panel shows it below the status lines. */
  description: string;
  type: GameType;
  /** The title is in Recently Downloaded. Arcade titles and demos are, and a disc is not. */
  recentlyDownloaded?: boolean;
}

interface KindCopy {
  /** The detail panel: the label of the top band, such as "Arcade Game". */
  kind: string;
  /** The detail panel: the two status lines beside the icon. */
  status: [string, string];
  /** The detail panel: the text of the Achievements band. */
  achievements: string;
}

const KIND_COPY: Record<GameType, KindCopy> = {
  full_game: {
    kind: "Xbox 360 Game",
    status: ["Full Version", "Play Now!"],
    achievements: "Earn achievements and compare your progress on Xbox LIVE.",
  },
  demo: {
    kind: "Game Demo",
    status: ["Demo Version", "Play Now for Free!"],
    achievements:
      "Unlock the full game to earn achievements and track your progress.",
  },
  arcade: {
    kind: "Arcade Game",
    status: ["Full Version", "Play Now!"],
    achievements: "Earn achievements and track your high score.",
  },
};

/** The titles that a filter tab shows. The caller handles "all" and the disabled tab. */
const TAB_FILTER: Partial<Record<TabKey, (game: MyGame) => boolean>> = {
  arcade: (game) => game.type === "arcade",
  demos: (game) => game.type === "demo",
  "recent-downloads": (game) => Boolean(game.recentlyDownloaded),
};

const PICS = "/assets/games_pics";

/** The destination of a launch. Each title opens the same URL. */
const LAUNCH_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

function launchGame() {
  window.location.assign(LAUNCH_URL);
}

const GAMES: MyGame[] = [
  {
    title: "Castlevania: Symphony of the Night",
    image: `${PICS}/csotn.png`,
    description:
      "Stalk Dracula's shifting castle as Alucard in the gothic masterpiece that defined Metroidvania.",
    type: "full_game",
  },
  {
    title: "Sonic the Hedgehog",
    image: `${PICS}/sth.png`,
    description:
      "Blue blur, blast processing, and loop-de-loops. Outrun Robotnik and free the animals of Green Hill.",
    type: "full_game",
  },
  {
    title: "Halo 3",
    image: `${PICS}/halo_3.png`,
    description:
      "Finish the fight. Master Chief's last stand against the Covenant, with co-op and legendary multiplayer.",
    type: "full_game",
  },
  {
    title: "Hexic",
    image: `${PICS}/hexic.png`,
    description:
      "Spin clusters of hexagons into matching colors. Deceptively simple, impossible to put down.",
    type: "arcade",
    recentlyDownloaded: true,
  },
  {
    title: "Castle Crashers",
    image: `${PICS}/castle_crashers.png`,
    description:
      "Four knights, one kidnapped princess, and a lot of swords. Chaotic hand-drawn co-op brawling.",
    type: "full_game",
  },
  {
    title: "Doritos Crash Course",
    image: `${PICS}/doritos_crash.png`,
    description:
      "A wipeout-style obstacle gauntlet. Sprint, slide, and faceplant your way to the leaderboard.",
    type: "full_game",
  },
  {
    title: "Doom",
    image: `${PICS}/doom.png`,
    description:
      "Shotgun in hand, hell underfoot. The run-and-gun blueprint every shooter since has borrowed from.",
    type: "full_game",
  },
  {
    title: "Midnight Club: Los Angeles",
    image: `${PICS}/midnight_club_la.png`,
    description:
      "Open-world street racing from Santa Monica to Hollywood. Pink slips, police chases and a living, breathing LA.",
    type: "full_game",
  },
  {
    title: "Call of Duty: Modern Warfare 3",
    image: `${PICS}/cod_mw3.png`,
    description:
      "World War III across three continents. Cinematic campaign, killstreaks, and relentless multiplayer.",
    type: "demo",
    recentlyDownloaded: true,
  },
];

/** The same radial green as the canvas of the Games blade. */
const BACKGROUND = gradientCss(GAMES_GRADIENT);

export function MyGamesScreen() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<TabKey>("all");
  const filter = TAB_FILTER[tab];
  const games = filter ? GAMES.filter(filter) : GAMES;

  // The cursor arrives from the row that opened the screen and returns
  // to it at the close. This hook is before the focus effect of the tab,
  // thus the code records that row before anything here takes the
  // focus.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    return () => opener?.focus();
  }, []);

  // Put the cursor on the first row at the open and after each tab
  // change. When a tab has no rows, as Demos does, focus the screen
  // itself. If the focus went to <body>, the key events would not reach
  // the handler of this root, Left and Right would do nothing, and the
  // user could not return to a tab with rows.
  useEffect(() => {
    const root = rootRef.current;
    const first = root?.querySelector<HTMLElement>(
      "[data-nav-list] [data-nav-item]:not(:disabled)",
    );
    (first ?? root)?.focus();
  }, [tab]);

  const selectTab = (next: TabKey) => {
    if (next === tab) return;
    playSound("selectA");
    setTab(next);
  };

  const stepTab = (delta: 1 | -1) => {
    const enabled = TABS.filter((entry) => !entry.disabled);
    const index = enabled.findIndex((entry) => entry.key === tab);
    const next = enabled[index + delta];
    if (!next) return;
    playSound("select");
    setTab(next.key);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      // Take Left and Right for the tab strip. `KeyboardNav` ignores a
      // prevented event.
      e.preventDefault();
      stepTab(e.key === "ArrowLeft" ? -1 : 1);
      return;
    }
    // With no rows, also take Up and Down. If it did not, the
    // no-focus fallback of `KeyboardNav` would put the cursor on a row
    // of the Games Library below this screen.
    if (games.length === 0 && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
    }
  };

  const items: LibraryMenuItem[] = games.map((game) => ({
    label: game.title,
    icon: <GameArt game={game} sizePx={36} />,
    onSelect: launchGame,
  }));

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="My Games"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-40 flex flex-col text-[#17300a] outline-none"
      style={{ background: BACKGROUND }}
    >
      <BladeScreenSurface gradient={GAMES_GRADIENT} />

      {/* The header and the legend are at z-0, below the shadow of the content band. */}
      <BladeChromeBand
        edge="top"
        className="relative z-0 px-[12%] pt-8 pb-5 md:pt-10 md:pb-6"
      >
        <h1 className="text-3xl text-white [text-shadow:0_1px_2px_rgba(0,0,0,.28)] sm:text-4xl">
          My Games
        </h1>
      </BladeChromeBand>

      {/* Content band: tab strip + list + panel, one raised slab (§5.4). */}
      <div
        className="relative z-10 flex min-h-0 flex-1 flex-col"
        style={{ boxShadow: CONTENT_BAND_SHADOW }}
      >
        <TabStrip tabs={TABS} active={tab} onSelect={selectTab} />

        <LibraryMenuProvider key={tab} initialItem={games[0] && { label: games[0].title }}>
          <GamesGrid games={games} items={items} />
        </LibraryMenuProvider>
      </div>

      <BladeChromeBand
        edge="bottom"
        className="relative z-0 px-[12%] pt-4 pb-8 md:pb-10"
      >
        <ButtonLegendBar
          left={[
            { label: "Download Games", letter: "Y" },
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
 * The filter tabs below the header (§5.5). They are plain text. The
 * active tab is white with the shadow of the title, the other tabs are
 * the dark green of the section, and a disabled tab is the low-contrast
 * green (§7.2). They are not nav items: Left and Right on the screen
 * change the tab and the cursor stays on the list.
 */
function TabStrip({
  tabs,
  active,
  onSelect,
}: {
  tabs: MyGamesTab[];
  active: TabKey;
  onSelect: (key: TabKey) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Filter games"
      className="relative flex flex-wrap items-baseline gap-x-10 gap-y-1 px-[12%] py-3 text-[26px]"
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            tabIndex={-1}
            onMouseEnter={() => !tab.disabled && !isActive && playSound("select")}
            onClick={() => onSelect(tab.key)}
            className={`cursor-pointer whitespace-nowrap transition-colors duration-150 focus:outline-none disabled:pointer-events-none ${
              isActive
                ? "text-white [text-shadow:0_1px_2px_rgba(0,0,0,.28)]"
                : "text-[#17300a] hover:text-white"
            } disabled:text-[#8fd36a]`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The column of the list and the counter, with the detail panel. This
 * component is inside `LibraryMenuProvider`, thus it can read the
 * highlighted row.
 *
 * Select, by Enter, Space or A, confirms the highlighted game. A hover
 * can highlight a row, and the panel follows that row, while the
 * keyboard cursor stays where it was. Thus Select first moves the focus
 * to the highlighted row, with the same `focus()` that the first row
 * gets at the open, then launches the game (`launchGame`, which goes to
 * `LAUNCH_URL`). A click on a row launches the game through the
 * `onSelect` of that row. The key handler here prevents the Enter and
 * Space click of the browser, thus the launch occurs one time.
 */
function GamesGrid({ games, items }: { games: MyGame[]; items: LibraryMenuItem[] }) {
  const highlighted = useHighlightedItem();

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isSelectKey(e)) return;
    const index = games.findIndex((game) => game.title === highlighted?.label);
    if (index === -1) return;
    const rows = e.currentTarget.querySelectorAll<HTMLElement>("[data-nav-item]");
    const row = rows[index];
    if (!row) return;
    // Take the key. This stops the Enter and Space click of the browser
    // on the focused button, and it stops a second click from
    // `KeyboardNav`.
    e.preventDefault();
    if (document.activeElement !== row) row.focus();
    playSound("selectA");
    launchGame();
  };

  return (
    <div
      data-nav-list="column"
      onKeyDown={onKeyDown}
      className="relative grid min-h-0 flex-1 grid-cols-1 gap-8 overflow-y-auto px-[12%] pt-3 pb-6 md:grid-cols-[minmax(0,52%)_1fr] md:gap-10"
    >
      <div className="flex min-w-0 flex-col">
        {games.length > 0 ? (
          <LibraryMenu items={items} growOnFocus ariaLabel="My Games list" />
        ) : (
          <p className="px-[13px] py-3 text-[23px] text-[#1f3b0d]">
            Nothing here yet.
          </p>
        )}
        <GameCounter games={games} />
      </div>
      <GameDetailPanel games={games} />
    </div>
  );
}

/** The "1 of 6" counter below the list. It follows the cursor and sits at the bottom of the column, level with the base of the panel. */
function GameCounter({ games }: { games: MyGame[] }) {
  const highlighted = useHighlightedItem();
  const index = games.findIndex((game) => game.title === highlighted?.label);
  return (
    <p
      aria-live="polite"
      className="mt-auto pt-6 text-center text-[22px] text-[#17300a]"
    >
      {games.length === 0 ? 0 : index + 1} of {games.length}
    </p>
  );
}

/**
 * The detail panel (§6.9): a tall rounded rectangle on a translucent
 * lighter green, divided into stacked bands and not by rules. Darker
 * header strips, such as "Arcade Game" and "Achievements", alternate
 * with a brighter content band, which holds the icon and the status
 * lines, then the one line of text of the title, then a transparent
 * body. Thus the change of colour is the separator. Its edge is the
 * button skin of the Games Library: the same 1 px #5a5a5a border and the
 * inset bevel on the top, the left and the right (`RAISED_BORDER` with
 * `RAISED_INSET_SHADOW`). It has no hover state and no focus state,
 * because it is a static readout and not a control. Thus it is not a nav
 * item and it never lights.
 */
function GameDetailPanel({ games }: { games: MyGame[] }) {
  const highlighted = useHighlightedItem();
  const game = games.find((entry) => entry.title === highlighted?.label);
  if (!game) return null;
  const copy = KIND_COPY[game.type];

  return (
    <aside
      aria-live="polite"
      aria-label={`${game.title} details`}
      className={`flex min-h-[400px] min-w-0 flex-col overflow-hidden rounded-[10px] text-[#17300a] ${RAISED_BORDER} ${RAISED_INSET_SHADOW}`}
      style={{ background: "rgba(255,255,255,.12)" }}
    >
      <PanelBand>{copy.kind}</PanelBand>
      <div
        className="flex items-center gap-5 px-5 py-4"
        style={{ background: "rgba(255,255,255,.18)" }}
      >
        <GameArt game={game} sizePx={72} />
        <div className="min-w-0 text-[24px] leading-snug">
          <p className="truncate">{copy.status[0]}</p>
          <p className="truncate">{copy.status[1]}</p>
        </div>
      </div>
      <p className="px-5 py-4 text-pretty text-[22px] leading-snug">
        {game.description}
      </p>
      <PanelBand>Achievements</PanelBand>
      <p className="flex-1 px-5 py-4 text-pretty text-[24px] leading-snug">
        {copy.achievements}
      </p>
    </aside>
  );
}

/**
 * The tile of the title artwork: the 64 px source PNGs from
 * `public/assets/games_pics`, at 36 px in a row and 72 px in the detail
 * panel, with a rounded corner and no border. The art sits directly on
 * the green.
 */
function GameArt({ game, sizePx }: { game: MyGame; sizePx: number }) {
  return (
    <Image
      src={game.image}
      alt=""
      width={64}
      height={64}
      className="shrink-0 rounded-[4px] object-cover"
      style={{ width: sizePx, height: sizePx }}
    />
  );
}

/** A darker translucent header strip in the detail panel, in the same tint as the chrome bands (§5.2). */
function PanelBand({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-black/10 px-5 py-2 text-[24px] leading-tight">{children}</div>
  );
}
