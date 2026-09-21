/**
 * The visualizers the Music Player's bumpers cycle (DESIGN.md §6.16).
 *
 * Its own module because the list has two owners: three of the four are
 * canvas-2D readings of the spectrum (`MusicVisualizer.tsx`) and the
 * fourth is a WebGL wave field (`WaterVisualizer.tsx`). Keeping the
 * registry with either one would make the other import it for a constant,
 * which is how `WaterVisualizer` ended up depending on `MusicVisualizer`
 * for a band count.
 */

export type VisualizerStyle = "led" | "mirror" | "radial" | "water";

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
];
