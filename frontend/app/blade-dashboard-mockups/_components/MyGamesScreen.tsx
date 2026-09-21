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
 * The "My Games" screen the Games Library's My Games row opens — the
 * third surface in the stack (Games blade → Games Library → here). Same
 * skin as the Games Library: the section green with the unclipped wave
 * sheen, darker header and legend bands, 12% side padding.
 *
 * Between the header and the content sits a tab strip (§5.5) — Arcade,
 * Demos, Recently Downloaded, Recently Played — that filters the list.
 * Left/Right step through the enabled tabs (the 360 used the bumpers;
 * under a modal the arrows have nothing else to do), clicking one works
 * too. Switching tabs remounts the list via `key` so the cursor lands on
 * the new first row.
 *
 * The list on the left reuses the Games blade's divider-separated rows
 * (`LibraryMenu` in its default `rows` layout) with each title's artwork
 * from `public/assets/games_pics`. "N of M" underneath tracks the cursor.
 * The detail panel on the right (§6.9) follows the cursor too, through the
 * same highlight provider the description pane uses elsewhere.
 *
 * Legend: Y Download Games, X unbound on the left; Back B / Select A on
 * the right. Select (Enter / Space / A) commits the highlighted game — see
 * `GamesGrid`. Back is owned by the row that opened this screen
 * (`MenuListItem` + `useBackKey`), so this takes no props.
 */
type TabKey = "all" | "arcade" | "demos" | "recent-downloads" | "recent-played";

interface MyGamesTab {
  key: TabKey;
  label: string;
  disabled?: boolean;
}

// "All Games" leads, as on the 360, so full games have somewhere to show up
// alongside the Arcade and Demo downloads.
const TABS: MyGamesTab[] = [
  { key: "all", label: "All Games" },
  { key: "arcade", label: "Arcade" },
  { key: "demos", label: "Demos" },
  { key: "recent-downloads", label: "Recently Downloaded" },
  { key: "recent-played", label: "Recently Played", disabled: true },
];

/**
 * What kind of title this is. Drives which filter tab lists it (Arcade →
 * `arcade`, Demos → `demo`) and the detail panel's header, status lines and
 * Achievements copy — see `KIND_COPY`.
 */
type GameType = "full_game" | "demo" | "arcade";

interface MyGame {
  title: string;
  /** Title artwork under `public/assets/games_pics/`. */
  image: string;
  /** One-line blurb shown in the detail panel under the status lines. */
  description: string;
  type: GameType;
  /** Listed under Recently Downloaded (arcade titles and demos, not discs). */
  recentlyDownloaded?: boolean;
}

interface KindCopy {
  /** Detail panel: top band label ("Arcade Game"). */
  kind: string;
  /** Detail panel: the two status lines beside the icon. */
  status: [string, string];
  /** Detail panel: the Achievements body copy. */
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

/** Which titles a filter tab shows; "all" and the disabled tab are handled by the caller. */
const TAB_FILTER: Partial<Record<TabKey, (game: MyGame) => boolean>> = {
  arcade: (game) => game.type === "arcade",
  demos: (game) => game.type === "demo",
  "recent-downloads": (game) => Boolean(game.recentlyDownloaded),
};

const PICS = "/assets/games_pics";

/** Where "playing" a game sends you. Every title launches the same thing. */
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

/** Same radial green as the Games blade canvas. */
const BACKGROUND = gradientCss(GAMES_GRADIENT);

export function MyGamesScreen() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<TabKey>("all");
  const filter = TAB_FILTER[tab];
  const games = filter ? GAMES.filter(filter) : GAMES;

  // Cursor handoff: focus comes in from the opener and goes back on close.
  // Declared before the per-tab focus effect so the opener is captured
  // before anything here takes focus.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    return () => opener?.focus();
  }, []);

  // Land the cursor on the first row on open and after every tab switch.
  // When a tab has no rows (Demos), focus the screen itself instead: if
  // focus fell to <body>, key events would bypass this root's handler and
  // Left/Right would be dead, with no way back to a populated tab.
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
      // Claim Left/Right for the tab strip; `KeyboardNav` skips prevented events.
      e.preventDefault();
      stepTab(e.key === "ArrowLeft" ? -1 : 1);
      return;
    }
    // With no rows, swallow Up/Down too — otherwise `KeyboardNav`'s
    // "nothing focused" fallback would drop the cursor onto a row of the
    // Games Library underneath this screen.
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

      {/* Header and legend sit at z-0, beneath the content band's shadow. */}
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
 * Filter tabs under the header (§5.5): plain text, the active one lifted
 * to white with the title's shadow, the rest in the section's dark green,
 * greyed ones in the low-contrast disabled green (§7.2). Not nav items —
 * Left/Right on the screen switch tabs, the cursor stays on the list.
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
 * The list + counter column and the detail panel. Lives inside
 * `LibraryMenuProvider` so it can read the highlighted row.
 *
 * Select (Enter / Space / A) commits the highlighted game: the mouse can
 * highlight a row by hovering — the panel follows it — while the keyboard
 * cursor stays where it was, so pressing Select moves focus onto the
 * highlighted row (the same `focus()` the first row gets on open), then
 * launches it (`launchGame`, which navigates to `LAUNCH_URL`). Clicking a
 * row launches it through the row's own `onSelect`; the key handler here
 * prevents the browser's Enter/Space click so the launch fires once.
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
    // Own the key: stops the browser's Enter/Space click on the focused
    // button and keeps `KeyboardNav` from clicking it again.
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

/** "1 of 6" under the list, following the cursor. Sits at the bottom of the column so it lines up with the panel's base. */
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
 * The detail panel (§6.9): a tall rounded rectangle on a translucent lighter
 * green, divided into stacked bands rather than ruled — darker header
 * strips ("Arcade Game", "Achievements") alternate with a brighter content
 * band (icon + status lines), the title's one-line blurb, and a transparent
 * body, so the colour shift itself is the separator. Its edge is the Games Library button skin —
 * the same 1px #5a5a5a border and top/left/right inset bevel
 * (`RAISED_BORDER` + `RAISED_INSET_SHADOW`) — minus the hover/focus
 * states: it's a static readout, not a control, so it isn't a nav item
 * and never lights up.
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
 * Title artwork tile: the 64px source PNGs from `public/assets/games_pics`,
 * shown at 36px in the rows and 72px in the detail panel, with a rounded
 * corner and no border — the art sits directly on the green.
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

/** Darker translucent header strip inside the detail panel — same tint as the chrome bands (§5.2). */
function PanelBand({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-black/10 px-5 py-2 text-[24px] leading-tight">{children}</div>
  );
}
