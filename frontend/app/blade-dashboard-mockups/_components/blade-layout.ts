import { bandClipPath } from "./blade-curve";

/**
 * Shared percentage math for the 1280×720 reference frame BladeEdges draws.
 * A fraction of that viewBox lands on the same fraction of the canvas
 * width/height (see BladeTabNav), so every absolutely-positioned piece of
 * chrome — tabs, the gray menu gutters, the content band — is expressed as
 * a percentage of these same constants instead of a one-off pixel value.
 */
export const pctX = (px: number) => (px / 1280) * 100;
export const pctY = (px: number) => (px / 720) * 100;

/*
 * DESIGN.md §1.2: the fan of tabs is one rhythm — 44 px wide on a 48 px
 * pitch — and the active panel is always the same 708 px wide. Which tabs
 * stack on the left and which on the right depends on which blade is open:
 * everything up to and including the active blade fans to the left of the
 * panel, everything after it to the right. So the panel slides as the
 * blade changes; with games (index 2) open it lands at 292–1000, the
 * numbers the design guide quotes.
 */
export const TAB_WIDTH = 44;
export const TAB_PITCH = 48;
export const LEFT_STACK_X = 152;
export const PANEL_WIDTH = 708;
/** Games is the default open blade (DESIGN.md §1). */
export const DEFAULT_ACTIVE_INDEX = 2;

/** Left edge of the active panel, in reference px, when blade `activeIndex` is open. */
export const panelLeftX = (activeIndex: number) =>
  LEFT_STACK_X + TAB_PITCH * activeIndex + TAB_WIDTH;
/** Right edge of the active panel, in reference px. */
export const panelRightX = (activeIndex: number) =>
  panelLeftX(activeIndex) + PANEL_WIDTH;

/**
 * Top-left x of tab `index` when blade `activeIndex` is open. Tabs at or
 * before the active one sit in the left stack; the rest start at the
 * panel's right edge.
 */
export const tabTopX = (index: number, activeIndex: number) =>
  index <= activeIndex
    ? LEFT_STACK_X + TAB_PITCH * index
    : panelRightX(activeIndex) + TAB_PITCH * (index - activeIndex - 1);

/** Left-stack tabs are mirrored (bow right, flare left) — DESIGN.md §1.1. */
export const tabMirrored = (index: number, activeIndex: number) =>
  index <= activeIndex;

/**
 * The panel straddles both curve families: its left edge bows/flares like
 * the left-stack tabs, its right edge like the right-stack ones.
 */
export const panelClipPath = (activeIndex: number) =>
  bandClipPath(panelLeftX(activeIndex), panelRightX(activeIndex), true, false);

/** Everything the chrome needs to know about where the panel is. */
export interface PanelGeometry {
  leftX: number;
  rightX: number;
  /** Left edge of the active panel / right edge of the left tab gutter, in canvas %. */
  leftPct: number;
  /** Distance from the canvas's right edge to the panel's right edge, in canvas %. */
  rightInsetPct: number;
  clipPath: string;
}

export function panelGeometry(activeIndex: number): PanelGeometry {
  const leftX = panelLeftX(activeIndex);
  const rightX = panelRightX(activeIndex);
  return {
    leftX,
    rightX,
    leftPct: pctX(leftX),
    rightInsetPct: 100 - pctX(rightX),
    clipPath: panelClipPath(activeIndex),
  };
}

/** Left edge of the active panel with the default (games) blade open. */
export const PANEL_LEFT_PCT = pctX(panelLeftX(DEFAULT_ACTIVE_INDEX));
/** Distance from the right edge to the panel's right edge, default blade. */
export const PANEL_RIGHT_INSET_PCT = 100 - pctX(panelRightX(DEFAULT_ACTIVE_INDEX));
/** Top of the blade title / content band. */
export const CONTENT_TOP_PCT = pctY(26);
