import Image from "next/image";
import {
  BladeCanvas,
  BladeBackground,
  BladeWaterControls,
  SHOW_WATER_CONTROLS,
  BladeEdges,
  BladePanelSeam,
  BladeMenuGutters,
  BladePanel,
  BladeTabNav,
  BladeNavProvider,
  type BladeSection,
  GAMES_THEME,
  MEDIA_THEME,
  SYSTEM_THEME,
  STORE_THEME,
  LIVE_THEME,
  STORE_GRADIENT,
  LIVE_GRADIENT,
  GAMES_GRADIENT,
  MEDIA_GRADIENT,
  SYSTEM_GRADIENT,
  GamerProfileCard,
  gamerStats,
  liveStats,
  GamerPicProvider,
  SignedInProfileProvider,
  LibraryMenu,
  LibraryMenuProvider,
  LibraryMenuDescription,
  type LibraryMenuItem,
  MediaSlot,
  type LegendButton,
  MenuIcon,
  OpenTrayBar,
  KeyboardNav,
  GamepadNav,
  PROFILE,
  XboxLiveBanner,
  DEFAULT_ACTIVE_INDEX,
} from "./_components";
import { asset } from "@/app/_lib/asset-path";

/**
 * The blade order, left to right (DESIGN.md §1). The index in this array
 * is the position of the open blade, which Left, Right and a tab click
 * change. The page opens on games (`DEFAULT_ACTIVE_INDEX`). Each entry
 * holds the identity of its section (§2.1, §2.2): the radial gradient,
 * as data from `blade-gradient.ts`, thus the CSS fallback and the WebGL
 * surface read the same stops; the fill of the active tab; and the text
 * and rule tints. Each of the five blades is built.
 */
const BLADES: BladeSection[] = [
  {
    label: "store",
    title: "Marketplace",
    // Marketplace orange with a peach core (DESIGN.md §2.1). The rules
    // are darker than the panel, as on Games.
    gradient: STORE_GRADIENT,
    tabFill: "linear-gradient(90deg,#b8500f,#ff9d4e 35%,#e06a1a)",
    theme: STORE_THEME,
  },
  {
    label: "community",
    title: "Xbox LIVE",
    gradient: LIVE_GRADIENT,
    tabFill: "linear-gradient(90deg,#c67a1a,#f8c85e 35%,#e39a2b)",
    theme: LIVE_THEME,
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
    // Purple, #804EA9 (DESIGN.md §2.1). The rules are lighter than the
    // panel, as on Media.
    gradient: SYSTEM_GRADIENT,
    tabFill: "linear-gradient(90deg,#613889,#b58ad9 35%,#8a58b6)",
    theme: SYSTEM_THEME,
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
 * The menu of the Marketplace blade (DESIGN.md §6.19), in two tiers. The
 * four stores are raised buttons, the skin of the Games Library rows.
 * The three account rows below them are compact divider rows. All four
 * tiles now have a real destination: Spotlight, New Arrivals and Game
 * Store all open the Spotlight screen (§6.20) under their own title —
 * `SpotlightScreen`, `NewArrivalsScreen` and `GameStoreListScreen` are
 * the same screen, since none of the three has real content of its own
 * yet — and Video Store opens the TV Shows screen (§6.19.3). Game
 * Store's own tile-based screen (§6.19.1, `"game-store"`) still exists
 * but nothing here links to it any more.
 */
const STORE_TILE_ITEMS: LibraryMenuItem[] = [
  {
    label: "Spotlight",
    icon: <MenuIcon name="spotlight" />,
    screen: "spotlight",
  },
  {
    label: "New Arrivals",
    icon: <MenuIcon name="newArrivals" />,
    screen: "new-arrivals",
  },
  {
    label: "Game Store",
    icon: <MenuIcon name="controller" />,
    screen: "game-store-list",
  },
  {
    label: "Video Store",
    icon: <MenuIcon name="videoStore" />,
    screen: "tv-shows",
  },
];

const STORE_ROW_ITEMS: LibraryMenuItem[] = [
  {
    label: "Redeem Code",
    icon: <MenuIcon name="redeemCode" />,
    detail: "Enter the code of a card or a promotion.",
  },
  {
    label: "Active Downloads",
    icon: <MenuIcon name="activeDownloads" />,
    detail: "See the content that is downloading now.",
  },
  {
    label: "Account Management",
    icon: <MenuIcon name="accountManagement" />,
    detail: "Manage your membership, your payment options and your Microsoft Points.",
  },
];

/**
 * The menu of the Xbox LIVE blade: one "Connect" row. The pane describes
 * it under the name of the service and not under the label of the row.
 * Select opens the Connect to Xbox LIVE drawer (DESIGN.md §6.22) rather
 * than the master-detail box (§5.3) every other row with `detail` gets:
 * signing in is worth a full pitch, not a 320 px box beside the row.
 */
const LIVE_MENU_ITEMS: LibraryMenuItem[] = [
  {
    label: "Connect to Xbox LIVE",
    icon: <MenuIcon name="globe" />,
    descriptionTitle: "Xbox LIVE",
    description:
      "Games. Tournaments. Entertainment. All the rewards. Endless possibilities. What are you waiting for?",
    screen: "connect-live",
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

/**
 * The menu of the System blade (DESIGN.md §6.18). Console Settings opens
 * the full-screen Console Settings screen. The other rows open a detail
 * box in this mockup. Computers reuses the monitor of the Music screen.
 * The pane keeps the line breaks of a description, thus the bullets of
 * Console Settings stay on their own lines.
 */
const SYSTEM_MENU_ITEMS: LibraryMenuItem[] = [
  {
    label: "Console Settings",
    icon: <MenuIcon name="consoleSettings" />,
    description:
      "Edit your Xbox 360 system settings, including:\n\n• Display\n• Audio\n• Language\n• Remote control\n• and more",
    screen: "console-settings",
  },
  {
    label: "Family Settings",
    icon: <MenuIcon name="family" />,
    description: "Control which games, videos and online content each member of your family can use.",
    detailTitle: "Family Settings",
    detail: "Set content limits, a timer and a pass code for the console.",
  },
  {
    label: "Memory",
    icon: <MenuIcon name="memory" />,
    description: "Manage the content on your hard drive and memory units.",
    detailTitle: "Memory",
    detail: "View, copy and delete the games, profiles and content that you saved.",
  },
  {
    label: "Network Settings",
    icon: <MenuIcon name="network" />,
    description: "Test and change the settings of your network connection.",
    detailTitle: "Network Settings",
    detail: "Test your connection to Xbox LIVE and edit your wired or wireless settings.",
  },
  {
    label: "Computers",
    icon: <MenuIcon name="computer" />,
    description: "Connect your console to a Windows PC to share its music, pictures and videos.",
    detailTitle: "Computers",
    detail: "Find and connect to the computers on your network.",
  },
  {
    label: "Initial Setup",
    icon: <MenuIcon name="initialSetup" />,
    description: "Set up your console again, as on the first day.",
    detailTitle: "Initial Setup",
    detail: "Choose your language, your display and your network again.",
  },
];

export default function BladeDashboardMockupsPage() {
  return (
    // One context shares the selected gamer picture, another which of
    // the two Sign In drawer profiles the user signed in as, across the
    // full blade.
    <SignedInProfileProvider>
    <GamerPicProvider>
    <BladeNavProvider blades={BLADES} initialIndex={DEFAULT_ACTIVE_INDEX}>
    {/* Up and Down move the cursor, Left and Right switch blades,
        Space and A select, and ESC and B go back. */}
    <KeyboardNav />
    {/* A controller drives the same keys. */}
    <GamepadNav />
    <BladeCanvas>
      <BladeMenuGutters />
      <BladeEdges />
      {/* The section gradient, the sheen, the rings and the gloss come
          from the WebGL surface in BladeCanvas. This is the CSS fallback
          of the sheen and the rings, and it renders nothing while the
          shader is live. */}
      <BladeBackground />
      {/* A soft dark seam just inside the open panel's own curved edges
          (DESIGN.md §1.1), on both sides, purely decorative. */}
      <BladePanelSeam />

      <BladeTabNav />

      {/* One panel for each blade. Only the panel of the open blade
          renders. Each panel is a 2x2 grid, thus the rows align:
            | Profile | Section logo |
            | Menu    | Description  |
          The description cell follows the highlighted menu row through
          LibraryMenuProvider, which is above both cells. */}
      <BladePanel blade="store" legend={SIGNED_IN_LEGEND}>
        {/* Two columns and no profile card, as the console drew the
            Marketplace: the menu on the left, and promotions in place of
            a description pane on the right (§6.19). Both menus sit in
            the one keyboard column of the panel, thus Down walks from
            the last tile into the rows. */}
        <div className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2 md:gap-x-8">
          <div className="flex min-w-0 flex-col gap-3">
            <LibraryMenu
              autoFocusFirst
              layout="buttons"
              items={STORE_TILE_ITEMS}
              ariaLabel="Marketplace stores"
            />
            <LibraryMenu items={STORE_ROW_ITEMS} ariaLabel="Marketplace account" />
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            {/* The promotion is a bitmap on the console. It keeps the
                striped placeholder (§6.7) until the art is available. */}
            <MediaSlot
              label="Guitar Hero III · Halo 3 Theme Song"
              className="aspect-[5/4]"
            />
            <XboxLiveBanner rings className="h-[112px]" />
          </div>
        </div>
      </BladePanel>

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
                src={asset("/assets/Xbox-Live-Logo-2005.png")}
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
                src={asset("/assets/XBOX_LOGO.png")}
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
                src={asset("/assets/XBOX_LOGO.png")}
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
      <BladePanel blade="system" legend={SIGNED_IN_LEGEND}>
        <LibraryMenuProvider initialItem={SYSTEM_MENU_ITEMS[0]}>
          {/* Two columns and no profile card, as the console drew the
              System blade: the menu and the pane of the highlighted row. */}
          <div className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2 md:gap-x-8">
            <LibraryMenu
              autoFocusFirst
              items={SYSTEM_MENU_ITEMS}
              ariaLabel="System menu"
            />
            <LibraryMenuDescription className="pt-2 text-pretty whitespace-pre-line text-[22px] leading-snug text-(--blade-ink) sm:text-[24px]" />
          </div>
        </LibraryMenuProvider>

        <OpenTrayBar label="Open Tray" />
      </BladePanel>
    </BladeCanvas>
    {/* The development overlay for the background water (§3.1). It is
        not part of the dashboard, and it is outside the canvas, thus the
        canvas never clips it. It is off by default. Set
        SHOW_WATER_CONTROLS to tune. */}
    {SHOW_WATER_CONTROLS && <BladeWaterControls />}
    </BladeNavProvider>
    </GamerPicProvider>
    </SignedInProfileProvider>
  );
}
