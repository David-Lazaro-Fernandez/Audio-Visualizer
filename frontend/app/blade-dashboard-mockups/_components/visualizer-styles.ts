/**
 * The visualizers the Music Player's bumpers cycle (DESIGN.md §6.16).
 *
 * Its own module because the list has several owners: three are
 * canvas-2D readings of the spectrum (`MusicVisualizer.tsx`) and four
 * are WebGL scenes (`WaterVisualizer.tsx`, `SpectrogramVisualizer.tsx`,
 * the shared `CurlParticles` from `app/_particles/` and the raymarched
 * core from `app/_raymarch/`).
 * Keeping the registry with any one of them would make the others import
 * it for a constant, which is how `WaterVisualizer` ended up depending on
 * `MusicVisualizer` for a band count.
 */

/**
 * Whether the visualizers' tuning overlays are mounted in the dashboard.
 *
 * Off, and it should stay off: this is a 10-foot UI and it has no
 * controls (§8). The panels exist to tune a field, not to ship inside
 * it — `/particles` keeps the curl one on screen, and this flag is the
 * way back in for the spectrogram. Switching it off does not stop the
 * curl field or the raymarched core drifting: those run from the scene,
 * not the panel.
 */
export const SHOW_VISUALIZER_CONTROLS: boolean = false;

export type VisualizerStyle =
  | "led"
  | "mirror"
  | "radial"
  | "water"
  | "spectrogram"
  | "curl"
  | "core";

/**
 * How many frequency bands every style is drawn from, and therefore how
 * many the analyser is asked for (`use-audio-spectrum.ts`).
 */
export const VISUALIZER_BANDS = 28;

/** In bumper order; they wrap, so there is no end to get stuck against. */
export const VISUALIZER_STYLES: { id: VisualizerStyle; label: string }[] = [
  { id: "led", label: "LED Matrix" },
  { id: "mirror", label: "Mirror Bars" },
  { id: "radial", label: "Radial" },
  { id: "water", label: "Water" },
  { id: "spectrogram", label: "Spectrogram" },
  { id: "curl", label: "Curl Field" },
  { id: "core", label: "Core" },
];
