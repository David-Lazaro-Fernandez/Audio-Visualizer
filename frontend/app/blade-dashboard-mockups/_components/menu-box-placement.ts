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
 * Finds a position for a detail box that stays inside the container. The
 * inputs are the box of the main content container and the box of the
 * selected menu item, both relative to the viewport, from
 * getBoundingClientRect. The function tries the right side of the item
 * first, then below the item. It returns null when there is not
 * sufficient space in either position. The caller must then render no
 * box, because a box that overflows is not acceptable.
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
