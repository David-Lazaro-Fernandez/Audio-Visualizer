import Image from "next/image";
import {
  BladeCanvas,
  BladeBackground,
  BladeWaterControls,
  SHOW_WATER_CONTROLS,
  BladeEdges,
  BladeMenuGutters,
  BladePanel,
  BladeTabNav,
  BladeNavProvider,
  type BladeSection,
  GAMES_THEME,
  MEDIA_THEME,
  STORE_GRADIENT,
  LIVE_GRADIENT,
  GAMES_GRADIENT,
  MEDIA_GRADIENT,
  SYSTEM_GRADIENT,
  GamerProfileCard,
  gamerStats,
  liveStats,
  GamerPicProvider,
  LibraryMenu,
  LibraryMenuProvider,
  LibraryMenuDescription,
  type LibraryMenuItem,
  type LegendButton,
  MenuIcon,
  OpenTrayBar,
  KeyboardNav,
  PROFILE,
  XboxLiveBanner,
  DEFAULT_ACTIVE_INDEX,
} from "./_components";

/**
 * Blade order, left to right (DESIGN.md §1). The index into this array is
 * the "which blade am I on" position that Left/Right and the tab clicks
 * move through; the page opens on games (`DEFAULT_ACTIVE_INDEX`). Each
 * entry carries its section identity (§2.1, §2.2): the radial gradient
 * (as data, from `blade-gradient.ts`, so the CSS fallback and the WebGL
 * surface read the same stops), the active-tab fill and the text/rule
 * tints. Games, Xbox LIVE and Media
 * are built; store and system are declared so the fan of tabs is complete
 * and switching to them shows a titled, empty panel rather than another
 * blade's content — their colors are placeholders.
 */
const BLADES: BladeSection[] = [
  {
    label: "store",
    title: "Marketplace",
    gradient: STORE_GRADIENT,
    tabFill: "linear-gradient(90deg,#b8500f,#ff9d4e 35%,#e06a1a)",
    theme: {
      ink: "#2e1202",
      inkSoft: "#3f1c05",
      rule: "#f7a869",
      ruleStrong: "#fbbd86",
      glyph: "#a24a0c",
      glyphHover: "#5e2a05",
      watermark: "#5a2a08",
    },
  },
  {
    label: "community",
    title: "Xbox LIVE",
    gradient: LIVE_GRADIENT,
    tabFill: "linear-gradient(90deg,#c67a1a,#f8c85e 35%,#e39a2b)",
    theme: {
      ink: "#2a1a04",
      inkSoft: "#3d2707",
      rule: "#f2c66a",
      ruleStrong: "#f7d585",
      glyph: "#a86a12",
      glyphHover: "#5e3a06",
      watermark: "#5a3a0a",
    },
  },
  {
    label: "games",
    title: "Games",
    gradient: GAMES_GRADIENT,
    tabFill: "linear-gradient(90deg,#478f14,#95e04d 35%,#57a91b)",
    theme: GAMES_THEME,
  },
  {
    label: "media",
    title: "Media",
    // Sky blue (DESIGN.md §2.1). Rules are lighter than the panel here, as
    // on Xbox LIVE, because the console's blue dividers read as pale lines.
    gradient: MEDIA_GRADIENT,
    tabFill: "linear-gradient(90deg,#2472b8,#86ccf6 35%,#3f97da)",
    theme: MEDIA_THEME,
  },
  {
    label: "system",
    title: "System",
    gradient: SYSTEM_GRADIENT,
    tabFill: "linear-gradient(90deg,#7f8891,#dfe4e9 35%,#a3acb5)",
    theme: {
      ink: "#1c1f23",
      inkSoft: "#2b3036",
      rule: "#8d969f",
      ruleStrong: "#a2abb4",
      glyph: "#5c656e",
      glyphHover: "#2b3036",
      watermark: "#3a4149",
    },
  },
];

/**
 * Legend for a signed-in blade (DESIGN.md §6.5): X signs out, A selects,
 * Y and B are unbound and dim.
 */
const SIGNED_IN_LEGEND: { left: LegendButton[]; right: LegendButton[] } = {
  left: [
    { label: "Y", letter: "Y", disabled: true },
    { label: "Sign Out", letter: "X" },
  ],
  right: [
    { label: "B", letter: "B", disabled: true },
    { label: "Select", letter: "A", sizePx: 28, fontSizePx: 21 },
  ],
};

/**
 * Games blade menu. `description` is the blurb the right-hand pane shows
 * while the row is highlighted; `detail` is the box that opens on select,
 * or `screen` a full-screen destination (Achievements → Achievements
 * screen, Played Games → Games Library).
 */
const GAMES_MENU_ITEMS: LibraryMenuItem[] = [
  {
    label: "Achievements",
    icon: <MenuIcon name="trophy" />,
    description: "Track your gaming accomplishments.",
    screen: "achievements",
  },
  {
    label: "Played Games",
    icon: <MenuIcon name="controller" />,
    description: "Review your game history.",
    screen: "games-library",
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

/**
 * Xbox LIVE blade menu: a single "Connect" row, described in the pane under
 * the service's own name rather than the row label.
 */
const LIVE_MENU_ITEMS: LibraryMenuItem[] = [
  {
    label: "Connect to Xbox LIVE",
    icon: <MenuIcon name="globe" />,
    descriptionTitle: "Xbox LIVE",
    description:
      "Games. Tournaments. Entertainment. All the rewards. Endless possibilities. What are you waiting for?",
    detailTitle: "Connect to Xbox LIVE",
    detail:
      "Sign in to Xbox LIVE to play online, chat with friends and download new content.",
  },
];

/**
 * Media blade menu. Music opens the full-screen Music screen (DESIGN.md
 * §6.11) and Pictures the full-screen picture grid (§6.13); the other rows
 * open a detail box in the mockup where the console's led to full-screen
 * browsers. Media Center has
 * no drawn icon on purpose: its Windows flag is a full-colour bitmap, so
 * the row shows `MenuListItem`'s neutral square until the image is dropped
 * in as `icon: <Image src="/assets/media_center.png" … />`.
 */
const MEDIA_MENU_ITEMS: LibraryMenuItem[] = [
  {
    label: "Music",
    icon: <MenuIcon name="music" />,
    description: "Play music from a CD, a portable device, or a PC.",
    screen: "music",
  },
  {
    label: "Pictures",
    icon: <MenuIcon name="pictures" />,
    description: "View pictures from a digital camera, a portable device, or a PC.",
    screen: "pictures",
  },
  {
    label: "Videos",
    icon: <MenuIcon name="videos" />,
    description: "Watch videos, movies, TV shows, and more.",
    detailTitle: "Videos",
    detail: "Play video from a disc, a connected device or your download queue.",
  },
  {
    label: "Media Center",
    description:
      "Connect to a Windows Media Center PC to enjoy your TV, music, pictures, and videos.",
    detailTitle: "Media Center",
    detail: "Set up this console as a Media Center Extender.",
  },
];

export default function BladeDashboardMockupsPage() {
  return (
    // Gamerpic selection is shared across the whole blade via context.
    <GamerPicProvider>
    <BladeNavProvider blades={BLADES} initialIndex={DEFAULT_ACTIVE_INDEX}>
    {/* Arrows move the cursor (Up/Down) and switch blades (Left/Right);
        Space/A selects; ESC/B goes back. */}
    <KeyboardNav />
    <BladeCanvas>
      <BladeMenuGutters />
      <BladeEdges />
      {/* The section gradient, sheen, rings and gloss come from the WebGL
          surface inside BladeCanvas; this is the CSS fallback for the
          sheen and rings, and renders nothing while the shader is live. */}
      <BladeBackground />

      <BladeTabNav />

      {/* One panel per blade; only the open blade's renders. Each is laid
          out as a 2×2 grid so rows line up:
            | Profile | Section logo |
            | Menu    | Description  |
          The description cell follows the highlighted menu row via
          LibraryMenuProvider, which sits above both cells. */}
      <BladePanel blade="store" />

      <BladePanel blade="community" legend={SIGNED_IN_LEGEND}>
        <LibraryMenuProvider initialItem={LIVE_MENU_ITEMS[0]}>
          {/* Third row on the left holds the LIVE ad tile; the description
              spans rows 2–3 on the right so it can run long. */}
          <div className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2 md:gap-x-8 md:gap-y-4">
            {/* Same signed-in gamer as the Games blade (`PROFILE`), shown
                through their Xbox LIVE rows. */}
            <GamerProfileCard profile={PROFILE} stats={liveStats(PROFILE)} />
            <div className="flex min-w-0 items-center justify-center">
              <Image
                src="/assets/Xbox-Live-Logo-2005.png"
                alt="Xbox LIVE"
                width={2000}
                height={1125}
                className="h-24 w-auto sm:h-32"
                priority
              />
            </div>
            <LibraryMenu
              autoFocusFirst
              items={LIVE_MENU_ITEMS}
              ariaLabel="Xbox LIVE menu"
            />
            <LibraryMenuDescription
              showTitle
              titleClassName="mb-1 text-[30px] leading-tight"
              className="pt-2 text-pretty text-[22px] leading-snug text-(--blade-ink) sm:text-[24px] md:row-span-2"
            />
            <XboxLiveBanner rings className="h-[112px]" />
          </div>
        </LibraryMenuProvider>

        <OpenTrayBar label="Open Tray" />
      </BladePanel>

      <BladePanel blade="games" legend={SIGNED_IN_LEGEND}>
        <LibraryMenuProvider initialItem={GAMES_MENU_ITEMS[0]}>
          <div className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2 md:gap-x-8 md:gap-y-4">
            <GamerProfileCard profile={PROFILE} stats={gamerStats(PROFILE)} />
            <div className="flex min-w-0 items-center justify-center">
              <Image
                src="/assets/XBOX_LOGO.png"
                alt="Xbox 360"
                width={500}
                height={500}
                loading="eager"
                className="h-28 w-auto sm:h-36"
              />
            </div>
            <LibraryMenu autoFocusFirst items={GAMES_MENU_ITEMS} />
            <LibraryMenuDescription className="pt-2 text-pretty text-[22px] leading-snug text-(--blade-ink) sm:text-[24px]" />
          </div>
        </LibraryMenuProvider>

        <OpenTrayBar label="Open Tray" />
      </BladePanel>

      <BladePanel blade="media" legend={SIGNED_IN_LEGEND}>
        <LibraryMenuProvider initialItem={MEDIA_MENU_ITEMS[0]}>
          {/* Same grid as Games. The card shows the gamer's Xbox LIVE rows
              (Rep, Gamerscore, Zone), as the console did on Media; the
              right column carries the Xbox 360 logo over the blurb. */}
          <div className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2 md:gap-x-8 md:gap-y-4">
            <GamerProfileCard profile={PROFILE} stats={liveStats(PROFILE)} />
            <div className="flex min-w-0 items-center justify-center">
              <Image
                src="/assets/XBOX_LOGO.png"
                alt="Xbox 360"
                width={500}
                height={500}
                loading="eager"
                className="h-28 w-auto sm:h-36"
              />
            </div>
            <LibraryMenu
              autoFocusFirst
              items={MEDIA_MENU_ITEMS}
              ariaLabel="Media menu"
            />
            <LibraryMenuDescription className="pt-2 text-pretty text-[22px] leading-snug text-(--blade-ink) sm:text-[24px]" />
          </div>
        </LibraryMenuProvider>

        <OpenTrayBar label="Open Tray" />
      </BladePanel>
      <BladePanel blade="system" />
    </BladeCanvas>
    {/* Development overlay for tuning the background water (§3.1). Not
        part of the dashboard, and outside the canvas so it is never
        clipped to it. Off by default; flip SHOW_WATER_CONTROLS to tune. */}
    {SHOW_WATER_CONTROLS && <BladeWaterControls />}
    </BladeNavProvider>
    </GamerPicProvider>
  );
}
