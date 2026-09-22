import { bandClipPath } from "./blade-curve";

/**
 * Shared percentage math for the 1280x720 reference frame that BladeEdges
 * draws. A fraction of that frame is the same fraction of the width and
 * the height of the canvas (refer to BladeTabNav). Thus each part of the
 * chrome that has an absolute position, which is the tabs, the gray menu
 * gutters and the content band, is a percentage of these constants and
 * not a single pixel value.
 */
export const pctX = (px: number) => (px / 1280) * 100;
export const pctY = (px: number) => (px / 720) * 100;

/*
 * DESIGN.md §1.2: the fan of tabs has one rhythm, 44 px wide on a 48 px
 * pitch, and the active panel is always 708 px wide. The open blade
 * decides which tabs stack on the left and which stack on the right. The
 * tabs up to and including the active blade fan to the left of the
 * panel, and the other tabs fan to the right. Thus the panel moves when
 * the blade changes. With games open, which is index 2, the panel is at
 * 292-1000, the values in the design guide.
 */
export const TAB_WIDTH = 44;
export const TAB_PITCH = 48;
export const LEFT_STACK_X = 152;
export const PANEL_WIDTH = 708;
/** Games is the default open blade (DESIGN.md §1). */
export const DEFAULT_ACTIVE_INDEX = 2;

/** Left edge of the active panel, in reference px, with blade `activeIndex` open. */
export const panelLeftX = (activeIndex: number) =>
  LEFT_STACK_X + TAB_PITCH * activeIndex + TAB_WIDTH;
/** Right edge of the active panel, in reference px. */
export const panelRightX = (activeIndex: number) =>
  panelLeftX(activeIndex) + PANEL_WIDTH;

/**
 * Top-left x of tab `index` with blade `activeIndex` open. A tab at or
 * before the active blade is in the left stack. The other tabs start at
 * the right edge of the panel.
 */
export const tabTopX = (index: number, activeIndex: number) =>
  index <= activeIndex
    ? LEFT_STACK_X + TAB_PITCH * index
    : panelRightX(activeIndex) + TAB_PITCH * (index - activeIndex - 1);

/** A left-stack tab is mirrored: it bows right and flares left (DESIGN.md §1.1). */
export const tabMirrored = (index: number, activeIndex: number) =>
  index <= activeIndex;

/**
 * The panel uses both curve families. Its left edge bows and flares as a
 * left-stack tab does, and its right edge as a right-stack tab does.
 */
export const panelClipPath = (activeIndex: number) =>
  bandClipPath(panelLeftX(activeIndex), panelRightX(activeIndex), true, false);

/** All that the chrome needs to know about the position of the panel. */
export interface PanelGeometry {
  leftX: number;
  rightX: number;
  /** Left edge of the active panel, which is also the right edge of the left tab gutter, in canvas %. */
  leftPct: number;
  /** Distance from the right edge of the canvas to the right edge of the panel, in canvas %. */
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

/** Left edge of the active panel with the default blade, games, open. */
export const PANEL_LEFT_PCT = pctX(panelLeftX(DEFAULT_ACTIVE_INDEX));
/** Distance from the right edge of the canvas to the panel, default blade. */
export const PANEL_RIGHT_INSET_PCT = 100 - pctX(panelRightX(DEFAULT_ACTIVE_INDEX));
/** Top of the blade title / content band. */
export const CONTENT_TOP_PCT = pctY(26);
