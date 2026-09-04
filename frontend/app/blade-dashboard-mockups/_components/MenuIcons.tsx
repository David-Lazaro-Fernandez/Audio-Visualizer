/**
 * Menu row icons (DESIGN.md §6.2 "small monochrome icon (left) + label"),
 * modelled on the 360 Games blade: trophy, controller, arcade stick, disc.
 * All four share one finish — a pale mint-to-green vertical gradient with a
 * dark green edge and a soft drop shadow — so they read as one glossy set
 * against the blade. Plain SVG, no client code, so they render on the
 * server and pass into `MenuListItem` as a node.
 */
export type MenuIconName = "trophy" | "controller" | "joystick" | "disc";

const EDGE = "#2f6d15";
const INK = "rgba(31,72,13,.85)";

export function MenuIcon({
  name,
  className,
}: {
  name: MenuIconName;
  className?: string;
}) {
  const gradId = `menu-icon-${name}-fill`;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      width="28"
      height="28"
      className={`shrink-0 ${className ?? ""}`}
      style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,.35))" }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4fbee" />
          <stop offset="0.45" stopColor="#d3f0b8" />
          <stop offset="1" stopColor="#8fd45f" />
        </linearGradient>
      </defs>
      <g fill={`url(#${gradId})`} stroke={EDGE} strokeWidth="1" strokeLinejoin="round">
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
        stroke="#eef9e4"
        strokeWidth="2.4"
        strokeLinecap="butt"
        strokeDasharray="3.2 2.6"
      />
      {/* dashed right half of the hole */}
      <path
        d="M16 13a3 3 0 0 1 0 6"
        fill="none"
        stroke="#eef9e4"
        strokeWidth="1.6"
        strokeLinecap="butt"
        strokeDasharray="1.8 1.6"
      />
    </>
  ),
};
