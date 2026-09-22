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
 * The blade order, left to right (DESIGN.md §1). The index in this array
 * is the position of the open blade, which Left, Right and a tab click
 * change. The page opens on games (`DEFAULT_ACTIVE_INDEX`). Each entry
 * holds the identity of its section (§2.1, §2.2): the radial gradient,
 * as data from `blade-gradient.ts`, thus the CSS fallback and the WebGL
 * surface read the same stops; the fill of the active tab; and the text
 * and rule tints. Games, Xbox LIVE and Media are built. Store and system
 * are declared, thus the fan of tabs is complete and a switch to them
 * shows an empty panel with a title and not the content of another
 * blade. Their colours are placeholders.
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
    // Sky blue (DESIGN.md §2.1). The rules are lighter than the panel,
    // as on Xbox LIVE, because the blue dividers of the console are pale
    // lines.
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
 * The legend of a signed-in blade (DESIGN.md §6.5): X signs out, A
 * selects, and Y and B are unbound and dim.
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
 * The menu of the Games blade. `description` is the text that the right
 * pane shows while the row is highlighted. `detail` is the box that
 * Select opens, and `screen` is a full-screen destination: Achievements
 * opens the Achievements screen and Played Games opens the Games
 * Library.
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
 * The menu of the Xbox LIVE blade: one "Connect" row. The pane describes
 * it under the name of the service and not under the label of the row.
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
 * The menu of the Media blade. Music opens the full-screen Music screen
 * (DESIGN.md §6.11) and Pictures opens the full-screen picture grid
 * (§6.13). The other rows open a detail box in this mockup, where the
 * console opened a full-screen browser. Media Center has no drawn icon:
 * its Windows flag is a full-colour bitmap, thus the row shows the
 * neutral square of `MenuListItem` until someone adds the image as
 * `icon: <Image src="/assets/media_center.png" ... />`.
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
    // A context shares the selected gamer picture across the full blade.
    <GamerPicProvider>
    <BladeNavProvider blades={BLADES} initialIndex={DEFAULT_ACTIVE_INDEX}>
    {/* Up and Down move the cursor, Left and Right switch blades,
        Space and A select, and ESC and B go back. */}
    <KeyboardNav />
    <BladeCanvas>
      <BladeMenuGutters />
      <BladeEdges />
      {/* The section gradient, the sheen, the rings and the gloss come
          from the WebGL surface in BladeCanvas. This is the CSS fallback
          of the sheen and the rings, and it renders nothing while the
          shader is live. */}
      <BladeBackground />

      <BladeTabNav />

      {/* One panel for each blade. Only the panel of the open blade
          renders. Each panel is a 2x2 grid, thus the rows align:
            | Profile | Section logo |
            | Menu    | Description  |
          The description cell follows the highlighted menu row through
          LibraryMenuProvider, which is above both cells. */}
      <BladePanel blade="store" />

      <BladePanel blade="community" legend={SIGNED_IN_LEGEND}>
        <LibraryMenuProvider initialItem={LIVE_MENU_ITEMS[0]}>
          {/* The third row on the left holds the LIVE tile. The
              description spans rows 2 and 3 on the right, thus it can be
              long. */}
          <div className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2 md:gap-x-8 md:gap-y-4">
            {/* The same signed-in gamer as the Games blade (`PROFILE`),
                with the Xbox LIVE rows. */}
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
          {/* The same grid as Games. The card shows the Xbox LIVE rows of
              the gamer, which are Rep, Gamerscore and Zone, as the
              console did on Media. The right column holds the console
              logo above the text. */}
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
    {/* The development overlay for the background water (§3.1). It is
        not part of the dashboard, and it is outside the canvas, thus the
        canvas never clips it. It is off by default. Set
        SHOW_WATER_CONTROLS to tune. */}
    {SHOW_WATER_CONTROLS && <BladeWaterControls />}
    </BladeNavProvider>
    </GamerPicProvider>
  );
}
