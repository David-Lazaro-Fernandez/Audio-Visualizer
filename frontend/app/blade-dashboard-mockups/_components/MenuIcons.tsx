/**
 * The icons of the menu rows (DESIGN.md §6.2: a small monochrome icon on
 * the left with a label). They follow the console dashboard. The set is:
 * the trophy, the controller, the arcade stick and the disc for the
 * Games blade; the globe with a controller of "Connect to Xbox LIVE" for
 * the Xbox LIVE blade; the disc with a note, the camera, the camcorder
 * and the Marketplace "m" roundel for the Media blade; the two stacked
 * game cards with a controller for the "All Games" filter of the
 * Achievements screen; the same trophy under a padlock for a locked
 * achievement tile; and the music menus (§6.11, §6.12, §6.14, §6.15):
 * the hard drive, the monitor and the portable player of the sources,
 * the microphone, the playlist, the note and the guitar of the browse
 * categories, and the play roundel, the playlist with a plus, the pencil
 * and the bin of the album and song actions.
 *
 * All the icons use one finish: translucent white at 50%, a lighter
 * white edge, inked details in translucent black, and a soft drop
 * shadow. Thus the section colour shows through and the set looks the
 * same on each blade. They are plain SVG with no client code, thus they
 * render on the server and go into `MenuListItem` as a node. This file
 * does not draw the full-colour bitmaps, such as the Windows flag of
 * Media Center. Those rows take an image node.
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
  | "lockedTrophy"
  | "hardDrive"
  | "computer"
  | "portableDevice"
  | "artists"
  | "playlist"
  | "song"
  | "genre"
  | "play"
  | "addToPlaylist"
  | "edit"
  | "delete";

/** The body fill: white at 50%, thus the gradient of the blade tints the glyph. */
const FILL = "rgba(255,255,255,.5)";
/** The edge: a stronger white, thus the silhouette stays visible on a pale panel. */
const EDGE = "rgba(255,255,255,.7)";
/** The inked details, such as the iris, the reel hubs and the "m": translucent black, neutral on each blade. */
const INK = "rgba(0,0,0,.32)";
/** The dashed and secondary strokes. They were pale green before. */
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
  /* A goblet: a wide rounded rim that becomes a narrow stem, with small
     loop handles at the rim and a flat base. */
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

  /* The silhouette of a console pad, leaning left as on the dashboard: a
     solid body with two grips, a concave arch between them and one hole
     for the guide button. There are no face buttons and no d-pad. The
     hole is a subpath wound in the opposite direction, thus the blade
     shows through it. */
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

  /* An arcade stick: a tapered rod with a rounded top, vertical on a
     thick slab. The full glyph leans near 20 degrees to the left, as on
     the dashboard, thus the base tilts and the stick stays perpendicular
     to the base. */
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

  /* A disc divided at the middle. The left half is solid, with the
     centre hole removed. The right half is only a dashed outline of the
     rim and the hole. This is the loading disc of the dashboard. */
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

  /* A globe with a controller at its lower right: the "Connect to Xbox
     LIVE" glyph of the console. The globe is a sphere with one meridian
     ellipse and two latitude lines. The small pad has two grips and an
     arched top and overlaps the bottom edge. The code draws the pad
     last, thus the pad is in front. */
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

  /* Music: a full disc with the centre hole removed, and an eighth note
     at its upper right. The code draws the note last, thus the head of
     the note overlaps the rim. */
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

  /* Pictures: a small camera. It has a body, a raised viewfinder, a lens
     with a dark iris, and a small flash window. */
  pictures: (
    <>
      <path d="M10.5 9.5l1.4-2.6a1 1 0 0 1 .9-.5h6.4a1 1 0 0 1 .9.5l1.4 2.6H26a2 2 0 0 1 2 2V24a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V11.5a2 2 0 0 1 2-2z" />
      <circle cx="16" cy="17.5" r="5.4" />
      <circle cx="16" cy="17.5" r="2.6" fill={INK} stroke="none" />
      <rect x="22.4" y="12" width="3.2" height="2.2" rx=".6" fill={INK} stroke="none" opacity=".8" />
      <ellipse cx="14.2" cy="15.6" rx=".9" ry="1.6" fill="#fff" stroke="none" opacity=".7" transform="rotate(35 14.2 15.6)" />
    </>
  ),

  /* Videos: a reel-to-reel camcorder. It has two film reels on top, a
     body, and a lens cone that points right. */
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

  /* Video Store: the Marketplace roundel, a sphere with a lowercase "m"
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

  /* All Games, on the Achievements screen: two game cards fanned one
     behind the other, with a small controller in front of their lower
     edge. This is the glyph of the console for each title. The
     controller is the `controller` silhouette above, smaller and drawn
     last. */
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
  /* The trophy above, with a padlock over its cup: a locked achievement
     (§6.10). The lock is inked, thus it looks like a mark on the glyph
     and not like a second object. */
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

  /* Hard Drive, on the Music screen: a drive unit with its lid off. It
     has an inked platter with a hub, the read arm across the platter,
     and an activity light at the lower right. */
  hardDrive: (
    <>
      <rect x="4" y="8" width="24" height="17" rx="2" />
      <circle cx="13.5" cy="16.5" r="5.4" fill="none" stroke={INK} strokeWidth="1.2" />
      <circle cx="13.5" cy="16.5" r="1.4" fill={INK} stroke="none" />
      <path d="M24 11.5l-7.6 6.2" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="24" cy="11.5" r="1.3" fill={INK} stroke="none" />
      <rect x="22" y="21.2" width="3.4" height="1.6" rx=".8" fill={INK} stroke="none" />
      <ellipse cx="7.4" cy="12.6" rx=".9" ry="2.4" fill="#fff" stroke="none" opacity=".6" />
    </>
  ),

  /* Computer, on the Music screen: a monitor on a short neck and a flat
     foot. The screen is inked, thus it reads as glass in the frame, with
     one diagonal gleam. */
  computer: (
    <>
      <path d="M14 21h4l1 4.2h-6z" />
      <rect x="9.5" y="24.8" width="13" height="2.6" rx="1.3" />
      <rect x="4" y="4.5" width="24" height="17" rx="1.8" />
      <rect x="6.6" y="7" width="18.8" height="12" rx=".8" fill={INK} stroke="none" />
      <path d="M9 17l7-8" fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity=".5" />
    </>
  ),

  /* Portable Device, on the Music screen: a pocket music player. It has
     an inked screen at the top and a click wheel with its centre button
     below. */
  portableDevice: (
    <>
      <rect x="9" y="3.5" width="14" height="25" rx="3" />
      <rect x="11.4" y="6.2" width="9.2" height="8" rx="1" fill={INK} stroke="none" />
      <circle cx="16" cy="21.2" r="4.4" fill="none" stroke={INK} strokeWidth="1.2" />
      <circle cx="16" cy="21.2" r="1.5" fill={INK} stroke="none" />
      <ellipse cx="11" cy="18" rx=".7" ry="2.4" fill="#fff" stroke="none" opacity=".6" />
    </>
  ),

  /* Artists, on the Audiobooks screen: a stage microphone. It has a
     round capsule with an inked grille, a U-shaped holder on a stem, and
     a foot. The code draws the capsule last, thus it sits in the holder. */
  artists: (
    <>
      <path d="M8.2 12.2h1.8a6 6 0 0 0 12 0h1.8a7.8 7.8 0 0 1-6.9 7.75V24h-1.8v-4.05a7.8 7.8 0 0 1-6.9-7.75z" />
      <rect x="11" y="24" width="10" height="2.6" rx="1.3" />
      <rect x="12" y="3.5" width="8" height="12.5" rx="4" />
      <path d="M12.6 7.6h6.8M12.3 10h7.4M12.6 12.4h6.8" fill="none" stroke={INK} strokeWidth=".9" />
      <ellipse cx="14" cy="6.6" rx=".7" ry="1.6" fill="#fff" stroke="none" opacity=".7" />
    </>
  ),

  /* Saved Playlists, on the Audiobooks screen: three lines of a list,
     the last one short, and the eighth note of `music` at their right. */
  playlist: (
    <>
      <rect x="4" y="7" width="14" height="3" rx="1.5" />
      <rect x="4" y="13" width="14" height="3" rx="1.5" />
      <rect x="4" y="19" width="9" height="3" rx="1.5" />
      <g transform="translate(-1 1.5)">
        <path d="M22.6 21.6V5.2c2.9.5 5.2 2.4 5.7 5.3-1.3-1.2-2.5-1.7-3.9-1.7v12.8z" />
        <ellipse cx="20.6" cy="22.6" rx="3.4" ry="2.4" transform="rotate(-18 20.6 22.6)" />
      </g>
    </>
  ),

  /* Songs, on the Audiobooks screen: one large eighth note, the stem
     with a curled flag and then the head. */
  song: (
    <>
      <path d="M17 23V4.5c3.8.6 6.9 3.1 7.6 7-1.8-1.6-3.4-2.3-5.2-2.3V23z" />
      <ellipse cx="14.4" cy="23.4" rx="4.6" ry="3.3" transform="rotate(-18 14.4 23.4)" />
      <ellipse cx="12.6" cy="22.4" rx=".8" ry="1.6" fill="#fff" stroke="none" opacity=".6" transform="rotate(60 12.6 22.4)" />
    </>
  ),

  /* Genres, on the Audiobooks screen: an acoustic guitar, leaning to the
     right. The body is one figure-eight path, thus the two bouts have
     one outline. It has an inked sound hole and bridge. The code draws
     the neck first, thus the body overlaps it. */
  genre: (
    <g transform="rotate(40 16 16)">
      <rect x="13.8" y="1" width="4.4" height="5" rx="1" />
      <rect x="15" y="5" width="2" height="7" />
      <path d="M16 10a4.5 4.5 0 0 0-4.5 4.5c0 2.5 1.5 3.5 1.1 4.7C11 20 10 21.3 10 23a6 6 0 0 0 12 0c0-1.7-1-3-2.6-3.8-.4-1.2 1.1-2.2 1.1-4.7A4.5 4.5 0 0 0 16 10z" />
      <circle cx="16" cy="20.2" r="2.1" fill={INK} stroke="none" />
      <rect x="13.5" y="24.2" width="5" height="1.4" rx=".7" fill={INK} stroke="none" />
      <ellipse cx="12.4" cy="23.4" rx=".8" ry="2" fill="#fff" stroke="none" opacity=".6" />
    </g>
  ),

  /* Play Album and Play Song: a roundel, as the `videoStore` one, with
     an inked play triangle across it. */
  play: (
    <>
      <circle cx="16" cy="16" r="11.5" />
      <path d="M13 10.5v11l9-5.5z" fill={INK} stroke="none" />
      <ellipse cx="11.2" cy="9.4" rx="1.6" ry="3" fill="#fff" stroke="none" opacity=".6" transform="rotate(35 11.2 9.4)" />
    </>
  ),

  /* Add to Current Playlist: the three list lines of `playlist`, with a
     plus sign in place of the note. */
  addToPlaylist: (
    <>
      <rect x="4" y="7" width="15" height="3" rx="1.5" />
      <rect x="4" y="13" width="15" height="3" rx="1.5" />
      <rect x="4" y="19" width="9" height="3" rx="1.5" />
      <path d="M20.6 15h2.8v4.6H28v2.8h-4.6V27h-2.8v-4.6H16v-2.8h4.6z" />
    </>
  ),

  /* Edit Album Info and Edit Song Info: a pencil, tip to the lower left.
     It has an inked eraser band and an inked lead at the tip. */
  edit: (
    <g transform="rotate(45 16 16)">
      <rect x="13" y="2.5" width="6" height="4" rx="1.4" />
      <path d="M13 6.5h6V22h-6z" />
      <path d="M13 22h6l-3 6z" />
      <path d="M15 26h2l-1 2z" fill={INK} stroke="none" />
      <path d="M13 6.5h6" fill="none" stroke={INK} strokeWidth="1.4" />
      <path d="M14.6 8.5V20" fill="none" stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity=".6" />
    </g>
  ),

  /* Delete Album and Delete Song: a bin. It has a handle on the lid, a
     body that narrows to the bottom, and three inked ribs. */
  delete: (
    <>
      <rect x="12.5" y="3.5" width="7" height="3.6" rx="1" />
      <rect x="6" y="6.5" width="20" height="3" rx="1" />
      <path d="M8 11h16l-1.4 15.2a2 2 0 0 1-2 1.8h-9.2a2 2 0 0 1-2-1.8z" />
      <path
        d="M12.5 14l.5 10.5M16 14v10.5M19.5 14l-.5 10.5"
        fill="none"
        stroke={INK}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </>
  ),
};
