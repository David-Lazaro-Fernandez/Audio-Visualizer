"use client";

import { createPortal } from "react-dom";
import type { BoxPlacement } from "./menu-box-placement";
import { getPortalRoot } from "./portal";
import { edgeOnlyClipPath } from "./blade-curve";

/**
 * The box of content that a menu item opens on a click (DESIGN.md §5.3,
 * master-detail), shared by every blade — Marketplace, Games, Media and
 * System all still open one for a row with no `screen` (Xbox LIVE's own
 * "Connect" row moved to the Sign In drawer, §6.22, but a future
 * Xbox LIVE row with `detail` would get the same box). `placeMenuBox`
 * gives its position in viewport coordinates, clamped to the space that
 * is available in the main container.
 *
 * The right edge is the §1.1 curve, not a straight line —
 * `edgeOnlyClipPath` at `topX = placement.maxWidth`, its own right edge,
 * rather than inset from it as the Sign In drawer's panel is. There is
 * no spare width here to reserve for the flare the way the drawer
 * reserves past its own seam: `placeMenuBox` already caps this box at
 * however much space is actually free beside the row, and a box that
 * claims more would overflow, which §5.3's third rule forbids outright.
 * Flush at its own edge, the curve's bow simply reads as a shallow
 * inward notch about a third of the way down, and the flare beyond it
 * has nothing to spill into — the box's own edge already ends there.
 * The content keeps a little extra right padding so text stays clear of
 * the notch.
 */
export function MenuDetailBox({
  placement,
  title,
  onClose,
  children,
}: {
  placement: BoxPlacement;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const clipPath = edgeOnlyClipPath(placement.maxWidth, false, placement.maxWidth);
  return createPortal(
    <div
      role="dialog"
      aria-label={title}
      className="fixed z-30 flex flex-col gap-2 overflow-auto py-4 pr-8 pl-4 text-[#151515]"
      style={{
        top: placement.top,
        left: placement.left,
        width: placement.maxWidth,
        maxHeight: placement.maxHeight,
        clipPath,
        background: "linear-gradient(180deg,#ffffff,#f2f2f2 52%,#dcdcdc)",
        boxShadow:
          "inset 0 1px 0 #fff,0 0 0 1px rgba(255,255,255,.7),0 8px 18px rgba(0,0,0,.28)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[19px] font-semibold">{title}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-[18px] leading-none text-[#5a5a5a] hover:text-black"
        >
          ×
        </button>
      </div>
      <div className="text-[15px] text-[#3a3a3a]">{children}</div>
    </div>,
    getPortalRoot(),
  );
}
