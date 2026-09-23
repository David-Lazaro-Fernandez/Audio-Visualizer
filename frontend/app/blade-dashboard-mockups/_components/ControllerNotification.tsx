"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { asset } from "@/app/_lib/asset-path";
import { playSound } from "./sounds";

/**
 * The toast that tells the user a controller is signed in (DESIGN.md
 * §6.17). `GamepadNav` mounts it when a pad connects, and removes it
 * after `onDone`.
 *
 * It is one container, the dark pill, with two children: the logo and
 * the text "<gamertag> signed in". The pill sets the height and the logo
 * fills it as a square, thus the two are always the same height. The
 * logo is the ring of light of the controller: four grey quadrants
 * between a black cross, with the quadrant of this pad lit green. On
 * the console the quadrant is the player number, thus pad 0 lights the
 * top left. Inside the ring the icon alternates between the Xbox 360
 * ball (`ball.png`) and the console, as the console did.
 *
 * The toast lives `TOTAL_MS` (7 s), with a 1 s open and a 1 s close
 * included. It comes in as
 * the console did: first the full shape shows as a faint, soft ghost,
 * then the pill draws itself from left to right over the ghost, and the
 * full ring glows green before it settles on the lit quadrant. The wipe
 * is a mask twice the width of the pill, opaque on its left half and
 * faint on its right half, that slides across. Thus one element is both
 * the ghost and the drawn part, and the text is wiped with the pill.
 * The close is the open backwards: the pill un-draws from right to left
 * and the ghost fades.
 * The animations use the Web Animations API, thus the timeline is in
 * one place and needs no keyframes in CSS. Under
 * `prefers-reduced-motion` they do not run and the toast just shows.
 *
 * It is `absolute` at 100 px from the bottom and always above the
 * full-screen surfaces (`z-50`, §5.1). It is a readout and not a cursor
 * stop, thus it does not take pointer events and it never takes focus.
 * `role="status"` announces it to a screen reader.
 *
 * Each mount plays the notification cue (§7.3). A new toast is a new
 * mount, thus each connect plays it again.
 */
export function ControllerNotification({
  gamertag,
  player,
  onDone,
}: {
  gamertag: string;
  /** The index of the pad, from 0. It selects the lit quadrant. */
  player: number;
  onDone: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<SVGSVGElement>(null);
  const [showConsole, setConsole] = useState(false);

  useEffect(() => {
    playSound("notification");
  }, []);

  useEffect(() => {
    const done = window.setTimeout(onDone, TOTAL_MS);
    const container = containerRef.current;
    const glow = glowRef.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !container || !glow) return () => window.clearTimeout(done);

    const timing = { duration: TOTAL_MS, fill: "both" } as const;
    const at = (ms: number) => ms / TOTAL_MS;
    // The close is the open played backwards: the pill un-draws from
    // right to left, then the ghost blurs and fades.
    const openEnd = OPEN_MS;
    const closeStart = TOTAL_MS - CLOSE_MS;
    const ghostIn = GHOST_MS;
    const wipeIn = GHOST_MS + WIPE_MS;
    const wipeOut = closeStart + WIPE_MS;
    const animations = [
      container.animate(
        [
          { opacity: 0, offset: 0 },
          { opacity: 1, offset: at(ghostIn) },
          { opacity: 1, offset: at(wipeOut) },
          { opacity: 0, offset: 1 },
        ],
        timing,
      ),
      container.animate(
        [
          { filter: "blur(6px)", offset: 0 },
          { filter: "blur(0px)", offset: at(wipeIn) },
          { filter: "blur(0px)", offset: at(closeStart) },
          { filter: "blur(6px)", offset: at(wipeOut) },
          { filter: "blur(6px)", offset: 1 },
        ],
        timing,
      ),
      // The wipe: the opaque half of the mask slides in from the left,
      // and slides back out at the close.
      container.animate(
        [
          { maskPosition: "100% 0", webkitMaskPosition: "100% 0", offset: 0 },
          { maskPosition: "100% 0", webkitMaskPosition: "100% 0", offset: at(ghostIn) },
          { maskPosition: "0% 0", webkitMaskPosition: "0% 0", offset: at(wipeIn) },
          { maskPosition: "0% 0", webkitMaskPosition: "0% 0", offset: at(closeStart) },
          { maskPosition: "100% 0", webkitMaskPosition: "100% 0", offset: at(wipeOut) },
          { maskPosition: "100% 0", webkitMaskPosition: "100% 0", offset: 1 },
        ],
        timing,
      ),
      // The full ring glows, then gives way to the lit quadrant by the
      // end of the open.
      glow.animate(
        [
          { opacity: 1, offset: 0 },
          { opacity: 1, offset: at(wipeIn) },
          { opacity: 0, offset: at(openEnd) },
          { opacity: 0, offset: 1 },
        ],
        timing,
      ),
    ];
    return () => {
      window.clearTimeout(done);
      for (const a of animations) a.cancel();
    };
  }, [onDone]);

  useEffect(() => {
    const id = window.setInterval(() => setConsole((c) => !c), ICON_SWAP_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      ref={containerRef}
      role="status"
      aria-live="polite"
      className="xboxNotification pointer-events-none absolute bottom-[100px] left-1/2 z-50 flex h-[96px] -translate-x-1/2 items-center rounded-full"
      style={{
        background: "rgba(44,52,40,.9)",
        boxShadow:
          "inset 0 0 0 2px rgba(96,106,90,.9), inset 0 2px 6px rgba(255,255,255,.08), 0 3px 8px rgba(0,0,0,.35)",
        maskImage: WIPE_MASK,
        WebkitMaskImage: WIPE_MASK,
        maskSize: "200% 100%",
        WebkitMaskSize: "200% 100%",
        maskPosition: "0% 0",
        WebkitMaskPosition: "0% 0",
      }}
    >
      <span
        className="relative aspect-square h-full shrink-0 rounded-full"
        style={{ background: "#1c2219", boxShadow: "0 0 0 2px rgba(96,106,90,.9)" }}
      >
        <RingOfLight player={player} />
        <svg ref={glowRef} viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#6ee23a"
            strokeWidth={11}
            style={{ filter: "drop-shadow(0 0 3px #8cff52)" }}
          />
        </svg>
        <span
          className="absolute inset-[21%] transition-opacity duration-300"
          style={{ opacity: showConsole ? 0 : 1 }}
        >
          <Image
            src={asset("/assets/ball.png")}
            alt=""
            width={368}
            height={368}
            className="size-full"
          />
        </span>
        <span
          className="absolute inset-0 transition-opacity duration-300"
          style={{ opacity: showConsole ? 1 : 0 }}
        >
          <ConsoleGlyph />
        </span>
      </span>
      <p className="pr-10 pl-4 text-[26px] leading-[1.15] whitespace-nowrap text-[#dfe3da]">
        {gamertag}
        <br />
        signed in
      </p>
    </div>
  );
}

/** How long the toast lives, with the open and the close included. */
const TOTAL_MS = 7000;
/** The open and the close take exactly this time each. */
const OPEN_MS = 1000;
const CLOSE_MS = 1000;
/**
 * The phases of the open. The ghost fades in, then the pill draws
 * itself, then the green ring fades to the lit quadrant in what is left
 * of `OPEN_MS`. The close uses the first two backwards: the wipe, then
 * the ghost fades out in what is left of `CLOSE_MS`.
 */
const GHOST_MS = 300;
const WIPE_MS = 500;
/** How long each icon shows before the other one replaces it. */
const ICON_SWAP_MS = 1500;

/**
 * Opaque on the left half and faint on the right half, with a soft seam.
 * At 200% width, a position of 100% shows only the faint half (the
 * ghost) and 0% shows only the opaque half.
 */
const WIPE_MASK = "linear-gradient(to right, #000 47%, rgba(0,0,0,.3) 53%)";

/** The quadrants in player order: top left, top right, bottom left, bottom right. */
const QUADRANTS = [
  "M 10 50 A 40 40 0 0 1 50 10",
  "M 50 10 A 40 40 0 0 1 90 50",
  "M 50 90 A 40 40 0 0 1 10 50",
  "M 90 50 A 40 40 0 0 1 50 90",
];

function RingOfLight({ player }: { player: number }) {
  const lit = ((player % 4) + 4) % 4;
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
      <defs>
        <linearGradient id="ring-lit" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#3fb61f" />
          <stop offset="1" stopColor="#9cff5c" />
        </linearGradient>
      </defs>
      {QUADRANTS.map((d, i) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={i === lit ? "url(#ring-lit)" : "#8a8f86"}
          strokeWidth={11}
        />
      ))}
      {/* The black cross that splits the ring into quadrants. */}
      <rect x="45" y="2" width="10" height="17" fill="#0c0f0b" />
      <rect x="45" y="81" width="10" height="17" fill="#0c0f0b" />
      <rect x="2" y="45" width="17" height="10" fill="#0c0f0b" />
      <rect x="81" y="45" width="17" height="10" fill="#0c0f0b" />
    </svg>
  );
}

/** The console, standing up: a slim white case with concave sides and the power button. */
function ConsoleGlyph() {
  return (
    <svg viewBox="0 0 100 100" className="size-full" aria-hidden>
      <defs>
        <linearGradient id="console-case" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#b3b5ae" />
          <stop offset="0.45" stopColor="#f0f0ec" />
          <stop offset="1" stopColor="#a4a69f" />
        </linearGradient>
      </defs>
      <path
        d="M 40 25 L 60 25 Q 55 50 60 75 L 40 75 Q 45 50 40 25 Z"
        fill="url(#console-case)"
        stroke="#5d6059"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <circle cx="50" cy="52" r="2.2" fill="#5d6059" />
    </svg>
  );
}
