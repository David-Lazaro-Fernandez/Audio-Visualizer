"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import type { MenuScreenProps } from "./MenuListItem";
import { getPortalRoot } from "./portal";
import { CANVAS_HEIGHT, edgeBandGeometry, edgeOnlyClipPath, edgeSvgPathD } from "./blade-curve";
import { BLADE_MOTION_EASE } from "./blade-motion";
import { ButtonLegendBar } from "./ButtonLegendBar";
import { LiveClock } from "./LiveClock";
import { useGamerPic } from "./GamerPicContext";
import { SIGN_IN_PROFILES, type SignInProfile } from "./profile";
import { useSignedInProfile } from "./SignedInProfileContext";
import { playSound } from "./sounds";
import { asset } from "@/app/_lib/asset-path";

/** The drawer's own slide-in, slower than the blade's own tempo (§7.4) because a drawer this size reads better easing in over a full second. */
const DRAWER_SLIDE_MS = 1000;

/**
 * The one coordinate the panel and the ribbon share: the §1.1 curve at
 * `SEAM_X`, non-mirrored (bow left, flare right — the family a tab to
 * the right of the open blade uses), is *both* the panel's own right
 * edge (`edgeOnlyClipPath`) *and* the ribbon's inner edge
 * (`edgeBandGeometry`'s left curve). Two shapes clipped from the exact
 * same curve at the exact same `topX` meet with no gap at every y, not
 * just at the sampled stops — drawing each edge separately, even from
 * the same math, left rounding and independent boxes room to drift
 * apart, which is what the transparent seam in the first version was.
 */
const SEAM_X = 360;
/**
 * Reference width of the wrapper's whole coordinate system: 501, the
 * ribbon's own flare reach (`leftPx + widthPx`) back when the ribbon
 * was a full 64px-thick band. Every percentage below — the panel's,
 * the ribbon's, the handle's, the padding's — is stated as a share of
 * this one fixed scale, the same way the mockup states everything else
 * as a share of the 1280-wide blade canvas, rather than being derived
 * live from the ribbon's own (now much thinner) width: recomputing it
 * from a narrower `RIBBON` would shrink this shared denominator too and
 * drag every other percentage's position sideways with it, including
 * ones — the panel's own width, the seam stroke's own scale — that have
 * nothing to do with how thick the ribbon happens to be.
 */
const DRAWER_WIDTH = 501;
/**
 * The ribbon's own thickness at its top, before the curve bows and
 * flares it (DESIGN.md §6.22) — tuned down slightly from the original
 * 64 so the rendered band comes out to ~30% of the wrapper
 * (`RIBBON_WIDTH_PCT`) rather than the ~31% a 64px-thick band gave. The
 * curve's own bow, at `SEAM_X` itself, sits further left than any
 * thickness this small reaches, so `RIBBON_LEFT` — and with it the seam
 * this ribbon shares with the panel — does not move when this number
 * does; only the ribbon's *outer* edge, which nothing else in the
 * drawer is anchored to, does.
 */
const RIBBON_THICKNESS = 30;
const RIBBON = edgeBandGeometry(SEAM_X, SEAM_X + RIBBON_THICKNESS, false);
/** The ribbon's own box already sits in the shared coordinate system (its left curve is the seam), so its CSS `left` is `RIBBON.leftPx` directly. */
const RIBBON_LEFT = RIBBON.leftPx;
/**
 * The `#3E3E3E` border belongs on the seam only — the curve the panel
 * and the ribbon share — and not on the ribbon's own outer (flare) edge
 * or its top/bottom caps, so a uniform inset border on the ribbon itself
 * is the wrong tool. It is an actual SVG stroke on that same `SEAM_X`
 * curve (`edgeSvgPathD`) and not another `clip-path` div: a `filter:
 * drop-shadow(...)` gets clipped away by a `clip-path` on the same
 * element, since clip-path clips the filter's own output and not just
 * the fill, so the shadow this needs (Figma reference node 216:17: a
 * solid 5 px line with a blurred, offset drop shadow) has nothing left
 * to clip it here.
 */
const SEAM_PATH_D = edgeSvgPathD(SEAM_X, false);
/**
 * The panel's own clip-path, at the same `SEAM_X`. Its box must reach at
 * least as far right as the curve's flare (§1.1's last y-stop) or its
 * background falls short of where the ribbon still overlaps it; +4 is
 * headroom, not a required margin.
 */
const PANEL_BOX_WIDTH = 441;
const PANEL_CLIP_PATH = edgeOnlyClipPath(SEAM_X, false, PANEL_BOX_WIDTH);
/** The sliding wrapper's own width, as a percentage of the viewport (DESIGN.md §6.22). */
const DRAWER_WIDTH_PCT = 50;
/** The panel's share of the wrapper's width, converted from its reference px so the two scale together. */
const PANEL_WIDTH_PCT = (PANEL_BOX_WIDTH / DRAWER_WIDTH) * 100;
/** The ribbon's own left and width, as a percentage of the wrapper — `RIBBON.clipPath` is already a percentage of *this* box, so scaling the box scales the clipped shape with it. */
const RIBBON_LEFT_PCT = (RIBBON_LEFT / DRAWER_WIDTH) * 100;
const RIBBON_WIDTH_PCT = (RIBBON.widthPx / DRAWER_WIDTH) * 100;
/**
 * The handle sits at the ribbon's own waist (§1.1's third y-stop, y=250
 * of 720, where the curve bows inward the most), so it reads as part of
 * the rim and not as a badge floating beside it. 0.2008 is the midpoint
 * between the ribbon's two edges at that y-stop, as a fraction of the
 * ribbon's own box width — precomputed from the same curve math
 * `edgeBandGeometry` samples, since the deltas themselves are not
 * exported. Recompute this fraction again if `RIBBON_THICKNESS`
 * changes: it is a function of how far apart the ribbon's two edges are
 * at the waist, not a fixed constant of the curve itself.
 */
const HANDLE_LEFT_PCT = ((RIBBON_LEFT + RIBBON.widthPx * 0.1408) / DRAWER_WIDTH) * 100;
const HANDLE_TOP_PCT = (250 / 720) * 100;
/**
 * The panel's own left/right padding (Tailwind's `pl-7`/`pr-28`, 28 px
 * and 112 px) as a percentage of the panel's own width instead of a
 * fixed px value, so the gap that keeps text clear of the curve's bow
 * (§6.22) grows with the panel rather than staying a fixed inset while
 * the curve it is protecting against grows past it.
 */
const PANEL_PADDING_LEFT_PCT = (28 / PANEL_BOX_WIDTH) * 100;
const PANEL_PADDING_RIGHT_PCT = (112 / PANEL_BOX_WIDTH) * 100;
const PANEL_HORIZONTAL_PADDING = {
  paddingLeft: `${PANEL_PADDING_LEFT_PCT}%`,
  paddingRight: `${PANEL_PADDING_RIGHT_PCT}%`,
};

/**
 * The Sign In drawer that the Xbox LIVE blade's "Connect to Xbox LIVE"
 * row opens (DESIGN.md §6.22), in place of the master-detail box (§5.3)
 * every other row with `detail` gets. It is the console's own Sign In
 * screen: a header band naming the screen and the console's live clock,
 * a brushed-silver body listing local profiles, and a footer band of
 * the four legend slots — pinned to the left edge of the viewport and
 * sliding in over a dimmed backdrop that still shows the Xbox LIVE
 * blade behind it, rather than a full-screen surface (§5.4).
 *
 * A row's click actually signs in as that profile: `useSignedInProfile`
 * persists the chosen gamertag, and `useActiveProfile`
 * (`SignedInProfileContext.tsx`) is what every gamer card, the picture
 * picker and the controller toast read instead of the static `PROFILE`,
 * so the whole app updates at once. Each row also shows whichever
 * picture `GamerPicContext` has on file for *its own* gamertag — a map
 * keyed by gamertag and not one shared value, since each of the two
 * mock profiles remembers its own pencil-icon pick independently, the
 * way two profiles on a real console would.
 *
 * **The panel and the ribbon share one curve.** Both are clipped from
 * the §1.1 curve at the same `SEAM_X` (`edgeOnlyClipPath` for the panel,
 * `edgeBandGeometry`'s left edge for the ribbon), so the panel's right
 * boundary and the ribbon's inner boundary are the same line, not two
 * independent approximations of it that can drift apart into a gap — an
 * earlier version clipped the panel to a plain rectangle and drew the
 * ribbon as an unrelated shape beside it, which left a strip of the
 * dimmed backdrop showing through wherever the two didn't happen to
 * line up. The panel's own content keeps extra right padding so no text
 * reaches the curve's bow, where the panel's own background — not the
 * ribbon — narrows. The ribbon and the handle are siblings of the panel,
 * not children, so they paint on top of it rather than being clipped by
 * it.
 *
 * It opens through the same `screen` mechanism as a full-screen
 * destination (`LibraryMenuItem.screen`, `MenuListItem`), so the row
 * owns the open state and the Back key exactly as it would for one, and
 * a click on the backdrop calls the same `onClose`, which plays the Back
 * cue (§7.3). `role="dialog"` and `aria-modal="true"` keep the D-pad
 * from switching blades underneath it (§8). There is no `×`: the
 * console's own screen has none, closing only by Back (B) or the
 * backdrop, so the focus moves onto the first profile at the open and
 * back to the row at the close, as every full-screen surface does
 * (§5.4).
 *
 * The slide is its own tempo, 1 s and not the blade's own 350 ms
 * (§7.4), because a panel this size reads better easing in slowly, and
 * the open plays the Page Left cue (§7.3) — the same cue a blade switch
 * to the left plays, since this too is new content sliding in from the
 * left. It is a `sign-in-slide-in` keyframe animation rather than a
 * transition on a toggled class: an animation plays its `from` state on
 * mount with no need to render one frame off-screen first and then flip
 * a class, the way a layer that merely toggles visibility would. The
 * backdrop fades in on the same tempo with its own keyframe. Both carry
 * the `blade-motion` class, so `prefers-reduced-motion` still cuts them
 * to an instant appearance.
 *
 * Closing plays the same two animations backwards: `sign-in-slide-out`
 * and `sign-in-backdrop-out`, distinct keyframes rather than the same
 * ones with `animation-direction: reverse`, because by the time a close
 * happens the entrance animation has already finished and sits parked
 * at its `to` state — flipping only the direction of a finished
 * animation does not reliably restart it, while naming a different
 * keyframe always does. This means the drawer cannot simply unmount the
 * instant `onClose` runs, unlike every other full-screen surface (§5.4):
 * it declares `EXIT_ANIMATION_MS`, which `MenuListItem` reads to keep
 * the drawer mounted — with `closing` set — for one more second after a
 * close, exactly as long as this animation takes, before it actually
 * unmounts.
 */
export function ConnectXboxLiveDrawer({ onClose, closing = false }: MenuScreenProps) {
  useEffect(() => {
    playSound("pageLeft");
    const opener = document.activeElement as HTMLElement | null;
    return () => opener?.focus();
  }, []);

  // Signing in as a row is what `SignedInProfileContext` shares app-wide
  // (`useActiveProfile`, DESIGN.md §6.3): no explicit choice yet reads as
  // the first row, matching the console's own list, which always shows
  // one profile already highlighted.
  const { selected, setSelected } = useSignedInProfile();
  const effective = selected ?? SIGN_IN_PROFILES[0].gamertag;
  // Each row's own picture can differ from its hardcoded default:
  // `GamerPicContext` keeps a pick per gamertag, made through the
  // profile card's pencil icon while that profile is the active one, so
  // a row here has to show that same remembered picture instead of the
  // mock's own `gamerpic`, or the two would visibly disagree the next
  // time this drawer opens.
  const { selections: gamerpicSelections } = useGamerPic();

  const slideAnimation = `${closing ? "sign-in-slide-out" : "sign-in-slide-in"} ${DRAWER_SLIDE_MS}ms ${BLADE_MOTION_EASE} both`;
  const backdropAnimation = `${closing ? "sign-in-backdrop-out" : "sign-in-backdrop-in"} ${DRAWER_SLIDE_MS}ms ${BLADE_MOTION_EASE} both`;

  return createPortal(
    <div className="fixed inset-0 z-40">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="blade-motion absolute inset-0 bg-black/50"
        style={{ animation: backdropAnimation }}
      />
      <div
        className="blade-motion absolute inset-y-0 left-0"
        style={{ width: `${DRAWER_WIDTH_PCT}%`, animation: slideAnimation }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Sign In"
          className="flex h-full flex-col text-[#151515]"
          style={{ width: `${PANEL_WIDTH_PCT}%`, clipPath: PANEL_CLIP_PATH }}
        >
          <div
            className="flex shrink-0 items-center justify-between py-5"
            style={{
              background: "linear-gradient(180deg,#4f5042 0%,#989995 50%,#848484 100%)",
              ...PANEL_HORIZONTAL_PADDING,
            }}
          >
            <h2 className="text-3xl text-white [text-shadow:0_1px_2px_rgba(0,0,0,.28)]">
              Sign In
            </h2>
            <LiveClock className="text-[22px] text-white tabular-nums [text-shadow:0_1px_2px_rgba(0,0,0,.28)]" />
          </div>

          <div
            data-nav-list="column"
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-6"
            style={{ background: "#B8B8B8", ...PANEL_HORIZONTAL_PADDING }}
          >
            {SIGN_IN_PROFILES.map((profile, index) => (
              <SignInRow
                key={profile.gamertag}
                profile={{
                  ...profile,
                  gamerpic: gamerpicSelections[profile.gamertag] ?? profile.gamerpic,
                }}
                selected={profile.gamertag === effective}
                autoFocus={index === 0}
                onSelect={() => setSelected(profile.gamertag)}
              />
            ))}
          </div>

          <div
            className="shrink-0 py-5"
            style={{
              background: "linear-gradient(180deg,#565656 0%,#9b9b97 50%,#878980 100%)",
              ...PANEL_HORIZONTAL_PADDING,
            }}
          >
            <ButtonLegendBar
              left={[
                { label: "Create New Profile", letter: "Y" },
                { label: "Recover Gamertag", letter: "X" },
              ]}
              right={[
                { label: "Back", letter: "B" },
                { label: "Select", letter: "A", sizePx: 28, fontSizePx: 21 },
              ]}
            />
          </div>
        </div>

        <SignInRibbon />
        <SignInSeamStroke />
        <SignInHandle />
      </div>
    </div>,
    getPortalRoot(),
  );
}

/**
 * Read by `MenuListItem` (`MenuScreenProps.closing`): a screen with no
 * such property unmounts the instant `onClose` runs, as every other one
 * still does, but this one asks to stay mounted, with `closing` set,
 * for this many ms first, so `sign-in-slide-out` and
 * `sign-in-backdrop-out` have time to finish before it actually leaves
 * the tree.
 */
ConnectXboxLiveDrawer.EXIT_ANIMATION_MS = DRAWER_SLIDE_MS;

/**
 * One local profile (DESIGN.md §6.2 `row`-adjacent, but the console's own
 * two-line profile row and not a menu icon row). A click signs in as
 * this row through `onSelect` (`SignedInProfileContext.setSelected`),
 * which is what makes `selected` — already highlighted for whichever
 * profile the context resolves to — able to change at all.
 */
function SignInRow({
  profile,
  selected,
  autoFocus,
  onSelect,
}: {
  profile: SignInProfile;
  selected: boolean;
  autoFocus: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      data-nav-item
      autoFocus={autoFocus}
      onMouseEnter={() => playSound("select")}
      onClick={() => {
        playSound("selectA");
        onSelect();
      }}
      className={`flex shrink-0 items-center gap-3.5 rounded-[8px] border px-3.5 py-2.5 text-left transition-colors duration-150 focus:outline-none ${
        selected
          ? "border-[#1e8a1e] bg-[linear-gradient(180deg,#fbfbfb,#e2e2e2)]"
          : "border-[#8f8f8f] bg-[linear-gradient(180deg,#d6d6d6,#c2c2c2)] hover:bg-[linear-gradient(180deg,#e2e2e2,#cccccc)] focus:bg-[linear-gradient(180deg,#e2e2e2,#cccccc)]"
      }`}
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[4px]">
        <Image
          src={asset(profile.gamerpic)}
          alt=""
          fill
          sizes="64px"
          className="object-cover"
          style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,.25)" }}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[21px] text-[#151515]">{profile.gamertag}</span>
        <span className="truncate text-[18px] text-[#5a5a5a]">{profile.account}</span>
      </div>
      <span className="shrink-0 text-[19px] text-[#3a3a3a]">{profile.storage}</span>
    </button>
  );
}

/**
 * The curved chrome ribbon that reads as the drawer's own edge (DESIGN.md
 * §6.22): two edges of the §1.1 curve, close together, exactly the shape
 * a collapsed tab is (`edgeBandGeometry`). Its inner (left) edge is the
 * very same curve, at the very same `SEAM_X`, that the panel is clipped
 * to, so the two meet with no gap. It carries the neutral collapsed-tab
 * fill (§2.3); the `#3E3E3E` border is `SignInSeamStroke`, below, and not
 * a shadow on this element, since it belongs on the seam only. It is a
 * sibling of the panel and not a child, so it paints on top of the
 * panel's own edge instead of being cut off by it.
 *
 * `left`/`width` are percentages of the wrapper (`RIBBON_LEFT_PCT` /
 * `RIBBON_WIDTH_PCT`), not the reference px `RIBBON_LEFT` /
 * `RIBBON.widthPx` directly: `RIBBON.clipPath` is already a polygon of
 * percentages *of this box*, so as long as the box keeps the same share
 * of the wrapper's width the wrapper was authored at, the clipped shape
 * scales with it exactly, whatever the wrapper's own rendered width is.
 */
function SignInRibbon() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0"
      style={{
        left: `${RIBBON_LEFT_PCT}%`,
        width: `${RIBBON_WIDTH_PCT}%`,
        clipPath: RIBBON.clipPath,
        background: "linear-gradient(90deg,#a9a9a9,#fbfbfb 30%,#dcdcdc 62%,#b6b6b6)",
        boxShadow: "3px 0 14px rgba(0,0,0,.35)",
      }}
    />
  );
}

/**
 * The `#3E3E3E` border, on the seam curve only (DESIGN.md §6.22) — not
 * the ribbon's own outer flare edge, and not its top/bottom caps, which
 * a uniform inset border on the ribbon would also draw, and not a `div`
 * clipped to the curve either (two earlier attempts): a `clip-path`
 * clips a `filter`'s own output along with the fill, so a `drop-shadow`
 * on a clipped div never had anywhere to spread into. This is a real SVG
 * `<path>` traced along the seam (`edgeSvgPathD`, the same curve
 * `sampleEdge` samples for every clip-path here), with nothing clipping
 * it, so `drop-shadow` — matching the reference, Figma node 216:17: a
 * solid 5 px line with a blurred, offset drop shadow — is free to
 * follow the stroke's own shape out past its edges. It is a sibling
 * painted after the ribbon so it sits on top of it.
 *
 * `width="100%"` rather than the reference px `DRAWER_WIDTH`, so the
 * viewBox's own coordinate space (still `DRAWER_WIDTH` wide) stretches
 * to fill the wrapper's actual rendered width exactly as the percentage
 * clip-paths above do, and the seam keeps tracing the same shared curve
 * the panel and the ribbon are clipped to.
 *
 * `pointer-events-none`, because this `<svg>`'s own box is the *whole*
 * wrapper — `overflow: visible` is what lets the stroke's drop-shadow
 * spread past the thin path it actually paints, but that same box, with
 * nothing painted across most of it, still hit-tests as a normal element
 * would without this: it sat over the profile rows and the legend
 * buttons, silently swallowing every click meant for them.
 */
function SignInSeamStroke() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 left-0"
      width="100%"
      height="100%"
      viewBox={`0 0 ${DRAWER_WIDTH} ${CANVAS_HEIGHT}`}
      preserveAspectRatio="none"
      style={{ overflow: "visible" }}
    >
      <path
        d={SEAM_PATH_D}
        fill="none"
        stroke="#3E3E3E"
        strokeWidth={5}
        vectorEffect="non-scaling-stroke"
        style={{ filter: "drop-shadow(0px 4px 4.5px rgba(0,0,0,.85))" }}
      />
    </svg>
  );
}

/**
 * The drawer's tab or handle: a small green ring, the console's own
 * ring-of-light motif reused as a static badge, sitting at the ribbon's
 * own waist so it reads as part of the rim rather than floating beside
 * it. `left` is `HANDLE_LEFT_PCT`, a percentage of the wrapper, for the
 * same reason the ribbon's own `left` is: the waist it marks moves with
 * the ribbon whenever the wrapper's rendered width does.
 */
function SignInHandle() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{
        left: `${HANDLE_LEFT_PCT}%`,
        top: `${HANDLE_TOP_PCT}%`,
        background: "radial-gradient(circle at 35% 30%, #565656, #232323 75%)",
        boxShadow: "0 0 0 1.5px rgba(255,255,255,.55), 0 2px 6px rgba(0,0,0,.5)",
      }}
    >
      <div
        className="absolute inset-[4px] rounded-full"
        style={{
          background:
            "conic-gradient(from -40deg, #1f5c0c 0deg, #6ee23a 90deg, #9cff5c 180deg, #1f5c0c 260deg, #1f5c0c 360deg)",
          WebkitMaskImage: "radial-gradient(circle, transparent 55%, black 58%)",
          maskImage: "radial-gradient(circle, transparent 55%, black 58%)",
          boxShadow: "0 0 4px rgba(120,255,120,.7)",
        }}
      />
    </div>
  );
}
