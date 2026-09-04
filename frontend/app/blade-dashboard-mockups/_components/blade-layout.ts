/**
 * Shared percentage math for the 1280×720 reference frame BladeEdges draws.
 * A fraction of that viewBox lands on the same fraction of the canvas
 * width/height (see BladeTabNav), so every absolutely-positioned piece of
 * chrome — tabs, the gray menu gutters, the content band — is expressed as
 * a percentage of these same constants instead of a one-off pixel value.
 */
export const pctX = (px: number) => (px / 1280) * 100;
export const pctY = (px: number) => (px / 720) * 100;

/** Left edge of the active panel (and right edge of the left tab gutter). */
export const PANEL_LEFT_PCT = pctX(292);
/** Distance from the right edge to the panel's right edge. */
export const PANEL_RIGHT_INSET_PCT = 100 - pctX(1000);
/** Top of the blade title / content band. */
export const CONTENT_TOP_PCT = pctY(26);
