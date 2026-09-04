import Image from "next/image";
import {
  BladeCanvas,
  BladeBackground,
  BladeEdges,
  BladeMenuGutters,
  BladeChromeBand,
  BladeTabNav,
  BladeNavProvider,
  type BladeTab,
  GamerProfileCard,
  GamerPicProvider,
  LibraryMenu,
  LibraryMenuProvider,
  LibraryMenuDescription,
  type LibraryMenuItem,
  MenuIcon,
  OpenTrayBar,
  ButtonLegendBar,
  KeyboardNav,
  MenuBoundary,
  PANEL_LEFT_PCT,
  PANEL_RIGHT_INSET_PCT,
} from "./_components";

/**
 * Blade order, left to right. The index into this array is the "which menu
 * am I on" position that Left/Right and the tab clicks move through; the
 * one flagged `active` is where the page opens (games, index 2).
 */
const BLADE_TABS: BladeTab[] = [
  { label: "store", topLeftX: 152, topRightX: 196, mirrored: true },
  { label: "community", topLeftX: 200, topRightX: 244, mirrored: true },
  {
    label: "games",
    topLeftX: 248,
    topRightX: 292,
    mirrored: true,
    active: true,
  },
  { label: "media", topLeftX: 1000, topRightX: 1044, mirrored: false },
  { label: "system", topLeftX: 1048, topRightX: 1092, mirrored: false },
];

/**
 * Games blade menu. `description` is the blurb the right-hand pane shows
 * while the row is highlighted; `detail` is the box that opens on select.
 */
const GAMES_MENU_ITEMS: LibraryMenuItem[] = [
  {
    label: "Achievements",
    icon: <MenuIcon name="trophy" />,
    description: "Track your gaming accomplishments.",
    detailTitle: "Achievements",
    detail: "View unlocked achievements across your library.",
  },
  {
    label: "Played Games",
    icon: <MenuIcon name="controller" />,
    description: "Review your game history.",
    detailTitle: "Played Games",
    detail: "See the games you've recently played.",
  },
  {
    label: "Xbox Live Arcade",
    icon: <MenuIcon name="joystick" />,
    description:
      "Enjoy these casual games and arcade classics. Check back often for new games.",
    detailTitle: "Xbox Live Arcade",
    detail: "Browse and download Xbox Live Arcade titles.",
  },
  {
    label: "Demos and More",
    icon: <MenuIcon name="disc" />,
    description: "Play demos and games.",
    detailTitle: "Demos and More",
    detail: "Try game demos and other downloadable content.",
  },
];

export default function BladeDashboardMockupsPage() {
  return (
    // Gamerpic selection is shared across the whole blade via context.
    <GamerPicProvider>
    <BladeNavProvider
      count={BLADE_TABS.length}
      initialIndex={Math.max(0, BLADE_TABS.findIndex((tab) => tab.active))}
    >
    {/* Arrows move the cursor (Up/Down) and switch blades (Left/Right);
        Space/A selects; ESC/B goes back. */}
    <KeyboardNav />
    <BladeCanvas background="radial-gradient(90% 80% at 50% 44%, #6ecb2e 0%, #52b81f 30%, #3e9c16 62%, #2f7e10 100%)">
      <BladeMenuGutters />
      <BladeEdges />
      {/* Rings render above the opaque panel gradient so the waves are visible. */}
      <BladeBackground />

      <BladeTabNav tabs={BLADE_TABS} />

      {/* Content layer: same 100% width/height as the tab layer above it
          (z-10 vs. z-20) — the panel bounds are just internal padding here,
          not the layer's own box, so both layers share one simple full-bleed
          shape instead of each being individually cropped to a sub-region. */}
      <MenuBoundary
        className="absolute inset-0 z-10 flex flex-col overflow-hidden"
        style={{
          paddingLeft: `${PANEL_LEFT_PCT}%`,
          paddingRight: `${PANEL_RIGHT_INSET_PCT}%`,
        }}
      >
        <BladeChromeBand
          edge="top"
          className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 md:px-8 md:pt-8 lg:px-10 lg:pt-10"
        >
          <h1 className="text-3xl text-white [text-shadow:0_1px_2px_rgba(0,0,0,.28)] sm:text-4xl">
            Games
          </h1>
        </BladeChromeBand>

        {/* One keyboard column: Up/Down runs from the gamerpic, down the
            library menu rows, and on to Open Tray at the bottom. */}
        <div
          data-nav-list="column"
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-6 md:gap-6 md:px-8 md:py-6 lg:px-10 lg:py-8"
        >
          {/*
            2x2 grid so rows line up:
            | Profile | Xbox logo    |
            | Menu    | Description  |
            The description cell follows the highlighted menu row via
            LibraryMenuProvider, which sits above both cells.
          */}
          <LibraryMenuProvider
            initialDescription={GAMES_MENU_ITEMS[0].description}
          >
          <div className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2 md:gap-x-8 md:gap-y-4">
            <GamerProfileCard
              gamertag="DavidTheLord"
              games={0}
              score={0}
              achievements={0}
            />
            <div className="flex min-w-0 items-center justify-center">
              <Image
                src="/assets/XBOX_LOGO.png"
                alt="Xbox 360"
                width={500}
                height={500}
                className="h-28 w-auto sm:h-36"
              />
            </div>
            <LibraryMenu autoFocusFirst items={GAMES_MENU_ITEMS} />
            <LibraryMenuDescription className="pt-2 text-pretty text-[22px] leading-snug text-[#17300a] sm:text-[24px]" />
          </div>
          </LibraryMenuProvider>

          <OpenTrayBar label="Open Tray" />
        </div>

        <BladeChromeBand
          edge="bottom"
          className="px-4 pb-4 pt-3 sm:px-6 sm:pb-6 md:px-8 md:pb-8 lg:px-10 lg:pb-10"
        >
          <ButtonLegendBar
            left={[
              { label: "Y", letter: "Y", disabled: true },
              { label: "Sign Out", letter: "X" },
            ]}
            right={[
              { label: "B", letter: "B", disabled: true },
              { label: "Select", letter: "A", sizePx: 28, fontSizePx: 21 },
            ]}
          />
        </BladeChromeBand>
      </MenuBoundary>
    </BladeCanvas>
    </BladeNavProvider>
    </GamerPicProvider>
  );
}
