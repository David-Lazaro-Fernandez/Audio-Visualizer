/**
 * DESIGN.md §2.2 Text on section color. Each blade paints its text, rules
 * and small glyphs in tints of its own section color, so the shared
 * components (menu rows, Open Tray, the media slot watermark) read those
 * colors from CSS custom properties instead of literal greens. The section
 * layout sets the games values as defaults on the font wrapper — which
 * also encloses the portal root, so full-screen surfaces stay green — and
 * `BladeCanvas` overrides them with the open blade's theme.
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

/** The games blade, DESIGN.md §2.2 — also the default for anything outside a canvas. */
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
 * The media blade, DESIGN.md §2.2 — sky blue. Rules are lighter than the
 * panel here because the console's blue dividers read as pale lines. Also
 * the theme of the full-screen surfaces the Media blade opens (Audiobooks).
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

/** The theme as inline-style custom properties (`--blade-ink`, ...). */
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
