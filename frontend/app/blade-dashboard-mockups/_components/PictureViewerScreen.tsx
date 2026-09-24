"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { getPortalRoot } from "./portal";
import { playSound } from "./sounds";
import { asset } from "@/app/_lib/asset-path";
import { PICTURES, pictureSrc } from "./pictures";
import type { MenuScreenProps } from "./MenuListItem";

/**
 * The picture viewer, which Play Slideshow or a tile of the picture
 * browser opens (DESIGN.md §6.13.2). Unlike every other full-screen
 * surface in this app, it is not the blade structure at all: the console
 * gave this screen no header, no blade chrome and no legend, because the
 * photo is the whole screen. `aria-modal` keeps the D-pad below it inert,
 * and Back still closes it, unannounced, the same way the Music Player's
 * own full-screen visualization has no legend of its own but still
 * answers Back (§6.16). The row or the tile that opened this screen owns
 * that Back key (`MenuListItem`, or the tile's own copy of that pattern),
 * thus this screen takes only a `startIndex` and nothing else.
 *
 * A floating transport bar sits centred in the lower third over the
 * photo: eight buttons, drawn as the Music Player's own simple monochrome
 * transport glyphs are (§6.16) and living with this screen for the same
 * reason, on a 5 px gap. The bar behind them is one steel pill: a single
 * light-to-dark grey fill in the neutral chrome of §2.3, carrying the
 * same pale top/bottom shine as the raised content band's own light
 * (Figma node 158:5, `CONTENT_BAND_SHADOW` in `BladeChromeBand.tsx`),
 * scaled down from a content band's height to a 36 px bar. A resting
 * button has no fill of its own, so that shine shows through it
 * unbroken; the cursor (hover or focus) is a pale green fill with a
 * matching glow and corners that round out further than a resting
 * button's, so the selected control visibly pops off the strip, as the
 * console's own cursor did. A caption below the bar, three quarters of
 * its width and centred under it, names whichever button the cursor is
 * on, its own text held to the left edge of that box, since the console
 * labelled only the one the cursor was on and not the rest.
 *
 * Every control really does something, in the spirit of the Music Player
 * (§6.16): the screen opens already advancing through the pictures on a
 * timer, which Pause/Play stops and restarts; Previous and Next step by
 * one; Stop returns to the first picture and pauses; Shuffle
 * re-randomises the advance order, as the Music Player's own sort
 * reverses its queue; Repeat decides whether reaching the last picture
 * wraps to the first or stops there; and Rotate Left and Rotate Right
 * turn the picture on screen a quarter turn, remembered per picture for
 * the rest of the session. The eight buttons are a `data-nav-list="8"`
 * row, thus Left and Right already step along them (§8).
 */

/** How long the slideshow lingers on a picture before it advances on its own. */
const SLIDESHOW_INTERVAL_MS = 4000;

type TransportShape =
  | "pause"
  | "play"
  | "previous"
  | "stop"
  | "next"
  | "shuffle"
  | "repeat"
  | "rotateLeft"
  | "rotateRight";

/** The four simple transport shapes, shared with the Music Player (§6.16). */
const GLYPHS: Record<"pause" | "play" | "previous" | "stop" | "next", string> = {
  pause: "M5 3h3.5v14H5zM11.5 3H15v14h-3.5z",
  play: "M5 3l11 7-11 7z",
  previous: "M5 3h2.5v14H5zm13 0v14l-9.5-7z",
  stop: "M4 4h12v12H4z",
  next: "M12.5 3H15v14h-2.5zM2 3l9.5 7L2 17z",
};

/**
 * The glyph finish. The bar is the console's neutral steel chrome and not
 * a blade colour (§2.3), so the glyphs sit on a light surface rather than
 * a dark one and are dark, not translucent white.
 */
const GLYPH_FILL = "rgba(45,58,64,.75)";
const GLYPH_STROKE = "rgba(20,30,34,.85)";

/**
 * The bar's own steel finish: a vertical light-to-dark gradient of the
 * neutral silvers of DESIGN.md §2.3 (the collapsed-tab fill and gutter
 * tones), because this floats over an arbitrary photo and is not any
 * blade's section colour.
 */
const BAR_BACKGROUND = "linear-gradient(180deg, #eef1f2 0%, #ccd4d7 50%, #a6b0b5 100%)";

/**
 * The caption's own background (Figma node 205:21): a single charcoal
 * fading in from fully transparent at the top edge to opaque at the
 * bottom, not a colour change. `stop-opacity: 0` on the same colour as
 * the solid stop is the reference's own way of writing that fade,
 * carried over here as one colour at two alphas.
 */
const TOOLTIP_BACKGROUND = "linear-gradient(180deg, rgba(60,60,60,0) 0%, rgba(70,70,70,1) 100%)";

/**
 * The bar's own shine: the pale-grey top/bottom fade of `CONTENT_BAND_SHADOW`
 * (Figma node 158:5, `BladeChromeBand.tsx`), scaled down from a content
 * band's height to a 48 px bar, plus a soft outer lift so the whole strip
 * reads as one raised piece of metal and not eight separately-lit tiles.
 */
const BAR_SHINE_SHADOW = [
  "inset 0 10px 10px -6px rgba(255,255,255,.7)",
  "inset 0 -10px 10px -6px rgba(0,0,0,.18)",
  "0 2px 8px rgba(0,0,0,.4)",
].join(", ");

/**
 * A resting button has no fill of its own, so the bar's shared steel
 * shows through it unbroken, with the 5 px gap between buttons and each
 * button's own 1 px `#616770` rim telling them apart. The cursor (hover
 * or focus) is the console's own tell for the selected control: a pale
 * green fill and a matching glow, so the selected one visibly pops off
 * the strip.
 */
const CONTROL_SKIN =
  "border border-[#616770] transition-[background-color,box-shadow] duration-150 " +
  "hover:z-10 hover:bg-[#ddf5bd] hover:shadow-[0_0_0_2px_rgba(255,255,255,.85),0_0_8px_2px_rgba(150,220,90,.65)] " +
  "focus:z-10 focus:bg-[#ddf5bd] focus:shadow-[0_0_0_2px_rgba(255,255,255,.85),0_0_8px_2px_rgba(150,220,90,.65)] focus:outline-none";

/**
 * The corner radius of one button in the row: the first button rounds
 * out on its left to meet the pill's own curve and stays tight on the
 * right where the next button starts, the last button mirrors it, and
 * every button in between stays uniformly tight — the same shape the
 * console's own segmented strip drew, one continuous pill with square
 * joints between its middle buttons.
 */
function buttonRadius(i: number, count: number): string {
  if (i === 0) return "rounded-[20px_5px_5px_20px]";
  if (i === count - 1) return "rounded-[5px_20px_20px_5px]";
  return "rounded-[5px]";
}

function TransportGlyph({ shape }: { shape: TransportShape }) {
  if (shape === "shuffle") {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
        <path
          d="M2 6h2.7c2.1 0 3.5 1 4.6 2.6M2 14h2.7c2.1 0 3.5-1 4.6-2.6M11.5 6.4h4.7M11.5 13.6h4.7"
          fill="none"
          stroke={GLYPH_STROKE}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path d="M18.5 6.4l-3.4-2.2v4.4zM18.5 13.6l-3.4-2.2v4.4z" fill={GLYPH_FILL} />
      </svg>
    );
  }
  if (shape === "repeat") {
    // A hand-rolled arc read as a hook rather than a loop (an open arc
    // reads as "rotate", not "repeat"). Two full arrows chasing each
    // other around a rectangle is the standard, unambiguous repeat mark.
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path
          d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"
          fill={GLYPH_FILL}
          stroke={GLYPH_STROKE}
          strokeWidth="0.5"
        />
      </svg>
    );
  }
  if (shape === "rotateLeft" || shape === "rotateRight") {
    const arc = shape === "rotateLeft" ? "M14.5 5a7 7 0 1 0 0 10" : "M5.5 5a7 7 0 1 1 0 10";
    const arrow = shape === "rotateLeft" ? "M14.5 2.8l3.2 2.6-4 1z" : "M5.5 2.8l-3.2 2.6 4 1z";
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
        <path d={arc} fill="none" stroke={GLYPH_STROKE} strokeWidth="1.6" strokeLinecap="round" />
        <path d={arrow} fill={GLYPH_FILL} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
      <path d={GLYPHS[shape]} fill={GLYPH_FILL} stroke={GLYPH_STROKE} strokeWidth="0.75" />
    </svg>
  );
}

export function PictureViewerScreen({ startIndex = 0 }: { startIndex?: number }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const [index, setIndex] = useState(startIndex);
  const [paused, setPaused] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const [loop, setLoop] = useState(true);
  const [rotations, setRotations] = useState<Record<number, number>>({});
  const [tooltipLabel, setTooltipLabel] = useState("Pause");
  // The caption's own width is 75% of the button row's width, thus it
  // has to be measured rather than given as a fixed size.
  const [barWidth, setBarWidth] = useState(0);

  // The order the slideshow advances through. Shuffle re-rolls it, the
  // way the Music Player's own sort reverses its queue (§6.16).
  const order = useMemo(() => {
    const indices = PICTURES.map((_, i) => i);
    if (!shuffled) return indices;
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  }, [shuffled]);

  const step = (delta: number) => {
    if (PICTURES.length === 0) return;
    const position = order.indexOf(index);
    let next = position + delta;
    if (next < 0) {
      next = loop ? order.length - 1 : 0;
    } else if (next >= order.length) {
      if (!loop) {
        setPaused(true);
        return;
      }
      next = 0;
    }
    setIndex(order[next]);
  };

  const stop = () => {
    setIndex(order[0] ?? 0);
    setPaused(true);
    playSound("selectA");
  };

  const rotate = (delta: number) => {
    setRotations((was) => ({ ...was, [index]: ((was[index] ?? 0) + delta + 360) % 360 }));
    playSound("selectA");
  };

  // The slideshow's own tempo: it advances on its own unless Pause holds
  // it or Repeat is off and it already reached the last picture.
  useEffect(() => {
    if (paused || PICTURES.length === 0) return;
    const id = setTimeout(() => step(1), SLIDESHOW_INTERVAL_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, index, order, loop]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    rootRef.current?.querySelector<HTMLElement>("[data-nav-item]")?.focus();
    return () => opener?.focus();
  }, []);

  // The row's own rendered width can change with the viewport, thus it is
  // measured rather than assumed.
  useEffect(() => {
    const update = () => setBarWidth(barRef.current?.getBoundingClientRect().width ?? 0);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const picture = PICTURES[index];

  const transport: {
    label: string;
    shape: TransportShape;
    act: () => void;
    pressed?: boolean;
  }[] = [
    {
      label: paused ? "Play" : "Pause",
      shape: paused ? "play" : "pause",
      act: () => {
        setPaused((was) => !was);
        playSound("selectA");
      },
    },
    { label: "Previous", shape: "previous", act: () => { step(-1); playSound("selectA"); } },
    { label: "Stop", shape: "stop", act: stop },
    { label: "Next", shape: "next", act: () => { step(1); playSound("selectA"); } },
    {
      label: "Shuffle",
      shape: "shuffle",
      act: () => {
        setShuffled((was) => !was);
        playSound("selectA");
      },
      pressed: shuffled,
    },
    {
      label: "Repeat",
      shape: "repeat",
      act: () => {
        setLoop((was) => !was);
        playSound("selectA");
      },
      pressed: loop,
    },
    { label: "Rotate Left", shape: "rotateLeft", act: () => rotate(-90) },
    { label: "Rotate Right", shape: "rotateRight", act: () => rotate(90) },
  ];

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Picture viewer"
      className="fixed inset-0 z-40 bg-black"
    >
      <div className="absolute inset-0 flex items-center justify-center">
        {picture && (
          <div
            className="relative h-full w-full transition-transform duration-300"
            style={{ transform: `rotate(${rotations[index] ?? 0}deg)` }}
          >
            <Image
              src={asset(pictureSrc(picture))}
              alt={picture.name}
              fill
              sizes="100vw"
              priority
              className="object-contain"
            />
          </div>
        )}
      </div>

      {/* One outer column holding two centred rows: the button row and
          the caption row (per the design's own two-`div` breakdown). */}
      <div className="absolute inset-x-0 bottom-[14%] flex flex-col items-center gap-1">
        <div
          ref={barRef}
          data-nav-list="8"
          role="group"
          aria-label="Slideshow controls"
          style={{ background: BAR_BACKGROUND, boxShadow: BAR_SHINE_SHADOW, opacity: 0.9 }}
          className="flex items-center justify-center gap-[5px] rounded-[50px] border border-[#B5BDC1] p-[5px]"
        >
          {transport.map(({ label, shape, act, pressed }, i) => (
            <button
              key={label}
              type="button"
              data-nav-item
              autoFocus={i === 0}
              aria-label={label}
              aria-pressed={pressed}
              onFocus={() => setTooltipLabel(label)}
              onMouseEnter={() => {
                playSound("select");
                setTooltipLabel(label);
              }}
              onClick={act}
              className={`flex h-9 w-[50px] items-center justify-center ${buttonRadius(i, transport.length)} ${CONTROL_SKIN}`}
            >
              <TransportGlyph shape={shape} />
            </button>
          ))}
        </div>
        <div className="flex w-full items-center justify-center">
          <span
            style={{
              width: barWidth * 0.75,
              // A trapezium, wide at the top and narrowed toward the
              // bottom, as a clip-path polygon rather than a 3D
              // `perspective`/`rotateX` tilt: a real shape reads correctly
              // at any size, where a near-zero rotation on a box this
              // small is nearly imperceptible and this codebase's own
              // shapes are already plain divs clipped this way, not 3D
              // transforms (DESIGN.md §1.1).
              clipPath: "polygon(0 0, 100% 0, 79% 100%, 21% 100%)",
              background: TOOLTIP_BACKGROUND,
            }}
            className="polygon px-3 py-1 text-left text-[15px] text-white/90"
          >
            <p className="ml-[50px]">{tooltipLabel}</p>
          </span>
        </div>
      </div>
    </div>,
    getPortalRoot(),
  );
}

/** A viewer bound to one starting picture, for a menu row or a tile to open. Refer to `screens.tsx`. */
export function pictureViewerFor(startIndex: number): React.ComponentType<MenuScreenProps> {
  const Screen: React.ComponentType<MenuScreenProps> = () => (
    <PictureViewerScreen startIndex={startIndex} />
  );
  Screen.displayName = `PictureViewerScreen(${startIndex})`;
  return Screen;
}
