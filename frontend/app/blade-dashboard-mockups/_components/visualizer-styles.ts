/**
 * The visualizers that the bumpers of the Music Player cycle (DESIGN.md
 * §6.16).
 *
 * This is a separate module, because the list has several owners. Three
 * visualizers are canvas-2D views of the spectrum
 * (`MusicVisualizer.tsx`). Four are WebGL scenes
 * (`WaterVisualizer.tsx`, `SpectrogramVisualizer.tsx`, the shared
 * `CurlParticles` from `app/_particles/` and the raymarched core from
 * `app/_raymarch/`). If the registry were in one of them, the others
 * would import that file for a constant. That is how `WaterVisualizer`
 * came to depend on `MusicVisualizer` for a band count.
 */

/**
 * Whether the dashboard mounts the tuning overlays of the visualizers.
 *
 * It is off and must stay off: this is a 10-foot UI and it has no
 * controls (§8). The panels exist to tune a field and not to ship in
 * one. `/particles` keeps the curl panel on the screen, and this flag
 * gives access to the spectrogram panel again. The flag does not stop
 * the walk of the curl field or of the raymarched core: the scene runs
 * that walk, not the panel.
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
 * The number of frequency bands that each style draws, which is also the
 * number that the code asks the analyser for (`use-audio-spectrum.ts`).
 */
export const VISUALIZER_BANDS = 28;

/** In bumper order. The list wraps, thus a user cannot reach an end. */
export const VISUALIZER_STYLES: { id: VisualizerStyle; label: string }[] = [
  { id: "led", label: "LED Matrix" },
  { id: "mirror", label: "Mirror Bars" },
  { id: "radial", label: "Radial" },
  { id: "water", label: "Water" },
  { id: "spectrogram", label: "Spectrogram" },
  { id: "curl", label: "Curl Field" },
  { id: "core", label: "Core" },
];
