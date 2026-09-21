/**
 * Menu row icons (DESIGN.md §6.2 "small monochrome icon (left) + label"),
 * modelled on the 360 dashboard: trophy, controller, arcade stick, disc
 * (Games blade), the globe-with-controller of "Connect to Xbox LIVE"
 * (Xbox LIVE blade), disc-with-note, camera, camcorder and the
 * Marketplace "m" roundel (Media blade), and the two stacked game cards
 * with a controller of the Achievements screen's "All Games" filter, and
 * the same trophy under a padlock for a locked achievement tile. All share one finish — translucent
 * white (50%) with a lighter white edge, inked details in translucent
 * black, and a soft drop shadow — so the section colour shows through and
 * the set looks the same on every blade. Plain SVG, no client code, so they
 * render on the server and pass into `MenuListItem` as a node. Full-colour
 * bitmaps (Media Center's Windows flag) are not drawn here; those rows take
 * an image node instead.
 */
export type MenuIconName =
  | "trophy"
  | "controller"
  | "joystick"
  | "disc"
  | "globe"
  | "music"
  | "pictures"
  | "videos"
  | "videoStore"
  | "allGames"
  | "lockedTrophy";

/** Body fill: white at 50%, so the blade's gradient tints the glyph. */
const FILL = "rgba(255,255,255,.5)";
/** Edge: a slightly stronger white so the silhouette holds on pale panels. */
const EDGE = "rgba(255,255,255,.7)";
/** Inked details (iris, reel hubs, the "m"): translucent black, blade-neutral. */
const INK = "rgba(0,0,0,.32)";
/** Dashed/secondary strokes that used to be pale green. */
const LIGHT = "rgba(255,255,255,.75)";

export function MenuIcon({
  name,
  className,
}: {
  name: MenuIconName;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      width="28"
      height="28"
      className={`shrink-0 ${className ?? ""}`}
      style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,.25))" }}
    >
      <g fill={FILL} stroke={EDGE} strokeWidth="1" strokeLinejoin="round">
        {ICONS[name]}
      </g>
    </svg>
  );
}

const ICONS: Record<MenuIconName, React.ReactNode> = {
  /* Goblet: wide rounded rim tapering into a narrow stem, small ear-loop
     handles at the rim, and a flat plinth. */
  trophy: (
    <>
      {/* ear handles (rings), drawn first so the cup overlaps them */}
      <path d="M10.5 6H8.4a2.6 2.6 0 0 0 0 5.2h1.6V9.6H8.6a1.1 1.1 0 0 1 0-2.2h1.9z" />
      <path d="M21.5 6h2.1a2.6 2.6 0 0 1 0 5.2H22V9.6h1.4a1.1 1.1 0 0 0 0-2.2h-1.9z" />
      {/* cup body */}
      <path d="M10 5.2a1.2 1.2 0 0 1 1.2-1.2h9.6A1.2 1.2 0 0 1 22 5.2V9c0 5.4-2.6 9.1-4.6 10.4h-2.8C12.6 18.1 10 14.4 10 9z" />
      {/* stem, flaring slightly toward the base */}
      <path d="M14.4 19.4h3.2l.7 3.8h-4.6z" />
      {/* plinth */}
      <path d="M11.2 23.2h9.6a1 1 0 0 1 1 1v1.6a1 1 0 0 1-1 1h-9.6a1 1 0 0 1-1-1v-1.6a1 1 0 0 1 1-1z" />
      {/* glossy highlight on the cup */}
      <ellipse cx="13.6" cy="9" rx="1.1" ry="3.2" fill="#fff" stroke="none" opacity=".7" />
    </>
  ),

  /* 360 pad silhouette, leaning left like the dashboard's: a solid body with
     two grips and a concave arch between them, and a single hole where the
     guide button sits. No face buttons or d-pad. The hole is a reverse-wound
     subpath so the blade shows through it. */
  controller: (
    <g transform="rotate(-18 16 16)">
      <path
        fillRule="evenodd"
        d="M9 9.5c2-1 4 0 7 0s5-1 7 0c2.5 1.3 4.5 6.5 5 10.5.4 2.8-1.2 4.5-3 4.5s-2.8-1.7-3.8-3.3c-1.4-2.2-3.7-3-5.2-3s-3.8.8-5.2 3c-1 1.6-2 3.3-3.8 3.3s-3.4-1.7-3-4.5c.5-4 2.5-9.2 5-10.5z M16 10.6a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 1 0 0-3.4z"
      />
      {/* soft sheen on the right shoulder, clear of the hole */}
      <path
        d="M18.6 11.3c1.3-.4 2.8-.2 4 .6"
        fill="none"
        stroke="#fff"
        strokeWidth="1"
        strokeLinecap="round"
        opacity=".6"
      />
    </g>
  ),

  /* Arcade stick: a tapered rod with a rounded top standing straight up on
     a thick slab. The whole piece leans ~20° to the left like the
     dashboard's, so the base tilts and the stick stays perpendicular to it. */
  joystick: (
    <g transform="rotate(-20 16 16)">
      {/* slab thickness: darker underside peeking out below */}
      <path
        d="M7 22.5h18a1.5 1.5 0 0 1 1.5 1.5v2.2a1.5 1.5 0 0 1-1.5 1.5H7a1.5 1.5 0 0 1-1.5-1.5V24A1.5 1.5 0 0 1 7 22.5z"
        fill={INK}
        opacity=".75"
      />
      {/* slab top face */}
      <path d="M7 20h18a1.5 1.5 0 0 1 1.5 1.5v3A1.5 1.5 0 0 1 25 26H7a1.5 1.5 0 0 1-1.5-1.5v-3A1.5 1.5 0 0 1 7 20z" />
      {/* stick: rounded knob on top, tapering down to the slab */}
      <path d="M12.7 8.4a3.3 3.3 0 0 1 6.6 0v1.4L17.7 20.2h-3.4L12.7 9.8z" />
      {/* glossy highlight down the knob */}
      <ellipse cx="14.9" cy="8.6" rx=".9" ry="2.4" fill="#fff" stroke="none" opacity=".75" />
    </g>
  ),

  /* Disc split down the middle: the left half is solid (with the centre
     hole cut out), the right half is only a dashed outline of the rim and
     the hole — the dashboard's "loading/streaming" disc. */
  disc: (
    <>
      {/* solid left half: outer rim down, then back up around the hole */}
      <path d="M16 3.5A12.5 12.5 0 0 0 16 28.5V19a3 3 0 0 1 0-6z" />
      {/* dashed right rim */}
      <path
        d="M16 3.5A12.5 12.5 0 0 1 16 28.5"
        fill="none"
        stroke={LIGHT}
        strokeWidth="2.4"
        strokeLinecap="butt"
        strokeDasharray="3.2 2.6"
      />
      {/* dashed right half of the hole */}
      <path
        d="M16 13a3 3 0 0 1 0 6"
        fill="none"
        stroke={LIGHT}
        strokeWidth="1.6"
        strokeLinecap="butt"
        strokeDasharray="1.8 1.6"
      />
    </>
  ),

  /* Globe with a controller tucked against its lower right, the 360's
     "Connect to Xbox LIVE" glyph: a sphere with one meridian ellipse and
     two latitude lines, and a small pad (two grips, arched top) overlapping
     its bottom edge, drawn last so it sits in front. */
  globe: (
    <>
      <circle cx="14" cy="13.5" r="10" />
      {/* meridian + latitudes, inked so they read on the pale sphere */}
      <ellipse cx="14" cy="13.5" rx="4.2" ry="10" fill="none" stroke={INK} strokeWidth=".9" />
      <path d="M4.6 10.4h18.8M4.6 16.6h18.8M14 3.5v20" fill="none" stroke={INK} strokeWidth=".9" />
      {/* controller, front and low-right */}
      <path d="M17.6 21.2c1.2-.6 2.6 0 4.2 0s3-.6 4.2 0c1.4.7 2.6 3.6 2.9 5.9.2 1.6-.7 2.6-1.8 2.6s-1.6-.9-2.2-1.8c-.8-1.2-2.1-1.7-3.1-1.7s-2.3.5-3.1 1.7c-.6.9-1.1 1.8-2.2 1.8s-2-1-1.8-2.6c.3-2.3 1.5-5.2 2.9-5.9z" />
    </>
  ),

  /* Music: a full disc (centre hole cut out) with an eighth note standing
     against its upper right, the note drawn last so its head overlaps the
     rim. */
  music: (
    <>
      <path
        fillRule="evenodd"
        d="M13 7.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 1 0 0-19zm0 6.7a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 1 1 0-5.6z"
      />
      <ellipse cx="9.4" cy="12.6" rx="1.2" ry="2.6" fill="#fff" stroke="none" opacity=".6" transform="rotate(35 9.4 12.6)" />
      {/* note: stem with a curled flag, then the head */}
      <path d="M22.6 21.6V5.2c2.9.5 5.2 2.4 5.7 5.3-1.3-1.2-2.5-1.7-3.9-1.7v12.8z" />
      <ellipse cx="20.6" cy="22.6" rx="3.4" ry="2.4" transform="rotate(-18 20.6 22.6)" />
    </>
  ),

  /* Pictures: a compact camera — body, raised viewfinder hump, lens with a
     dark iris and a small flash window. */
  pictures: (
    <>
      <path d="M10.5 9.5l1.4-2.6a1 1 0 0 1 .9-.5h6.4a1 1 0 0 1 .9.5l1.4 2.6H26a2 2 0 0 1 2 2V24a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V11.5a2 2 0 0 1 2-2z" />
      <circle cx="16" cy="17.5" r="5.4" />
      <circle cx="16" cy="17.5" r="2.6" fill={INK} stroke="none" />
      <rect x="22.4" y="12" width="3.2" height="2.2" rx=".6" fill={INK} stroke="none" opacity=".8" />
      <ellipse cx="14.2" cy="15.6" rx=".9" ry="1.6" fill="#fff" stroke="none" opacity=".7" transform="rotate(35 14.2 15.6)" />
    </>
  ),

  /* Videos: a reel-to-reel camcorder — two film reels on top, a body, and a
     lens cone pointing right. */
  videos: (
    <>
      <circle cx="9.5" cy="9" r="4.4" />
      <circle cx="17.5" cy="9" r="4.4" />
      <circle cx="9.5" cy="9" r="1.3" fill={INK} stroke="none" />
      <circle cx="17.5" cy="9" r="1.3" fill={INK} stroke="none" />
      <path d="M6 13.5h15a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 21 25.5H6A1.5 1.5 0 0 1 4.5 24v-9A1.5 1.5 0 0 1 6 13.5z" />
      <path d="M22.5 17l6-3.2v11.4l-6-3.2z" />
      <ellipse cx="8.4" cy="16.6" rx="1" ry="1.8" fill="#fff" stroke="none" opacity=".6" transform="rotate(35 8.4 16.6)" />
    </>
  ),

  /* Video Store: the Marketplace roundel — a sphere with a lowercase "m"
     inked across it. */
  videoStore: (
    <>
      <circle cx="16" cy="16" r="11.5" />
      <path
        d="M9.4 21.2v-7.4M9.4 16.4a3.1 3.1 0 0 1 6.2 0v4.8M15.6 16.4a3.1 3.1 0 0 1 6.2 0v4.8"
        fill="none"
        stroke={INK}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <ellipse cx="11.2" cy="9.4" rx="1.6" ry="3" fill="#fff" stroke="none" opacity=".6" transform="rotate(35 11.2 9.4)" />
    </>
  ),

  /* All Games (Achievements screen): two game cards fanned behind each
     other, with a small controller resting in front of their lower edge —
     the 360's "every title on the console" glyph. The controller is the
     `controller` silhouette above, scaled down and drawn last. */
  allGames: (
    <>
      <rect x="9" y="3.5" width="12" height="16" rx="1.6" transform="rotate(-14 15 11.5)" />
      <rect x="12" y="6" width="12" height="16" rx="1.6" transform="rotate(6 18 14)" />
      <ellipse cx="14.6" cy="10" rx="1" ry="3" fill="#fff" stroke="none" opacity=".6" transform="rotate(6 14.6 10)" />
      <g transform="translate(3.5 12.5) scale(.68) rotate(-18 16 16)">
        <path
          fillRule="evenodd"
          d="M9 9.5c2-1 4 0 7 0s5-1 7 0c2.5 1.3 4.5 6.5 5 10.5.4 2.8-1.2 4.5-3 4.5s-2.8-1.7-3.8-3.3c-1.4-2.2-3.7-3-5.2-3s-3.8.8-5.2 3c-1 1.6-2 3.3-3.8 3.3s-3.4-1.7-3-4.5c.5-4 2.5-9.2 5-10.5z M16 10.6a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 1 0 0-3.4z"
        />
      </g>
    </>
  ),
  /* The trophy above, with a padlock sitting over its cup: a locked
     achievement (§6.10). The lock is inked so it reads as a mark on the
     glyph rather than a second object. */
  lockedTrophy: (
    <>
      <g opacity=".55">
        {/* ear handles (rings), drawn first so the cup overlaps them */}
        <path d="M10.5 6H8.4a2.6 2.6 0 0 0 0 5.2h1.6V9.6H8.6a1.1 1.1 0 0 1 0-2.2h1.9z" />
        <path d="M21.5 6h2.1a2.6 2.6 0 0 1 0 5.2H22V9.6h1.4a1.1 1.1 0 0 0 0-2.2h-1.9z" />
        {/* cup body */}
        <path d="M10 5.2a1.2 1.2 0 0 1 1.2-1.2h9.6A1.2 1.2 0 0 1 22 5.2V9c0 5.4-2.6 9.1-4.6 10.4h-2.8C12.6 18.1 10 14.4 10 9z" />
        {/* stem, flaring slightly toward the base */}
        <path d="M14.4 19.4h3.2l.7 3.8h-4.6z" />
        {/* plinth */}
        <path d="M11.2 23.2h9.6a1 1 0 0 1 1 1v1.6a1 1 0 0 1-1 1h-9.6a1 1 0 0 1-1-1v-1.6a1 1 0 0 1 1-1z" />
        {/* glossy highlight on the cup */}
        <ellipse cx="13.6" cy="9" rx="1.1" ry="3.2" fill="#fff" stroke="none" opacity=".7" />
      </g>
      {/* padlock: shackle then body, over the lower cup */}
      <path
        d="M13.2 15.4v-2.1a2.8 2.8 0 0 1 5.6 0v2.1"
        fill="none"
        stroke={INK}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <rect x="11.4" y="15.2" width="9.2" height="7" rx="1.4" fill={INK} stroke="none" />
      <rect x="11.4" y="15.2" width="9.2" height="7" rx="1.4" fill="none" stroke={EDGE} />
      <circle cx="16" cy="18.4" r="1" fill="#fff" stroke="none" opacity=".85" />
    </>
  ),
};
