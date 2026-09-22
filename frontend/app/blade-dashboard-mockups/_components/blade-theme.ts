/**
 * Text on the section colour, DESIGN.md §2.2. Each blade paints its
 * text, rules and small glyphs in tints of its own section colour. Thus
 * the shared components, which are the menu rows, the Open Tray and the
 * watermark of the media slot, read those colours from CSS custom
 * properties and not from literal greens. The section layout sets the
 * games values as the defaults on the font wrapper, which also contains
 * the portal root. Thus a full-screen surface stays green. `BladeCanvas`
 * then replaces the values with the theme of the open blade.
 */
export interface BladeTheme {
  /** Primary text on the section color. */
  ink: string;
  /** Secondary / meta text. */
  inkSoft: string;
  /** Row divider lines. */
  rule: string;
  /** List top/bottom rule. */
  ruleStrong: string;
  /** Small CSS-shape glyphs (the Open Tray eject mark). */
  glyph: string;
  glyphHover: string;
  /** Monospace watermark on empty media slots. */
  watermark: string;
}

/** The games blade, DESIGN.md §2.2. It is also the default outside a canvas. */
export const GAMES_THEME: BladeTheme = {
  ink: "#17300a",
  inkSoft: "#1f3b0d",
  rule: "#379226",
  ruleStrong: "#43AB33",
  glyph: "#3e941d",
  glyphHover: "#1f5c0c",
  watermark: "#2b4a12",
};

/**
 * The media blade, DESIGN.md §2.2, in sky blue. The rules are lighter
 * than the panel, because the blue dividers of the console are pale
 * lines. The full-screen surfaces that the Media blade opens, such as
 * Audiobooks, also use this theme.
 */
export const MEDIA_THEME: BladeTheme = {
  ink: "#0a2240",
  inkSoft: "#123056",
  rule: "#7cc4f2",
  ruleStrong: "#a3d7f7",
  glyph: "#2a74b8",
  glyphHover: "#143f6e",
  watermark: "#123a60",
};

/** The theme as inline-style custom properties: `--blade-ink` and the others. */
export function themeVars(theme: BladeTheme): React.CSSProperties {
  return {
    "--blade-ink": theme.ink,
    "--blade-ink-soft": theme.inkSoft,
    "--blade-rule": theme.rule,
    "--blade-rule-strong": theme.ruleStrong,
    "--blade-glyph": theme.glyph,
    "--blade-glyph-hover": theme.glyphHover,
    "--blade-watermark": theme.watermark,
  } as React.CSSProperties;
}
