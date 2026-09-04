import type { MeasuredRect } from "./useRect";

export interface BoxPlacement {
  top: number;
  left: number;
  maxWidth: number;
  maxHeight: number;
}

const GAP = 16;
const MIN_WIDTH = 220;
const MIN_HEIGHT = 96;
const MAX_WIDTH = 320;

/**
 * Given the main content container's box and the clicked menu item's box
 * (both viewport-relative, from getBoundingClientRect), work out where a
 * detail box can go without spilling outside the container: first try
 * beside the item (to its right), then below it. Returns null when neither
 * has enough room — the caller should not render a box at all rather than
 * let it overflow.
 */
export function placeMenuBox(
  container: MeasuredRect,
  anchor: MeasuredRect,
): BoxPlacement | null {
  return placeBeside(container, anchor) ?? placeBelow(container, anchor);
}

function placeBeside(
  container: MeasuredRect,
  anchor: MeasuredRect,
): BoxPlacement | null {
  const left = anchor.right + GAP;
  const availableWidth = container.right - left;
  const availableHeight = container.bottom - anchor.top;

  if (availableWidth < MIN_WIDTH || availableHeight < MIN_HEIGHT) return null;

  return {
    top: anchor.top,
    left,
    maxWidth: Math.min(availableWidth, MAX_WIDTH),
    maxHeight: availableHeight,
  };
}

function placeBelow(
  container: MeasuredRect,
  anchor: MeasuredRect,
): BoxPlacement | null {
  const top = anchor.bottom + GAP;
  const availableWidth = container.right - anchor.left;
  const availableHeight = container.bottom - top;

  if (availableWidth < MIN_WIDTH || availableHeight < MIN_HEIGHT) return null;

  return {
    top,
    left: anchor.left,
    maxWidth: Math.min(availableWidth, MAX_WIDTH),
    maxHeight: availableHeight,
  };
}
