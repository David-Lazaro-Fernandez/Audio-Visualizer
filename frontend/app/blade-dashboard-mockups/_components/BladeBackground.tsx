import { PANEL_CLIP_PATH } from "./BladeEdges";

/**
 * DESIGN.md §3 Materiality: a soft concentric sheen baked into the radial
 * background, plus 2 looping ripple rings that "propagate from the center"
 * like waves. `animate` mirrors the design doc's recreation note that the
 * rings can be animated on a loop for a more faithful feel.
 */
export function BladeBackground({ animate = true }: { animate?: boolean }) {
  return (
    // Clipped to the panel curve so the waves stay on the active blade and
    // don't spill onto the collapsed tab gutters. Rendered above BladeEdges'
    // opaque gradient, otherwise the rings would be hidden beneath it.
    <div
      className="pointer-events-none absolute inset-0"
      style={{ clipPath: PANEL_CLIP_PATH }}
    >
      <div
        className="absolute inset-0"
        style={{
          // Concentric light/dark bands so the waves actually read against
          // the base green. Alternating bright + shadow rings, fading out
          // toward the edges.
          background: [
            "radial-gradient(circle at 50% 44%, rgba(255,255,255,.14) 0%, rgba(255,255,255,0) 14%)",
            "radial-gradient(circle at 50% 44%, rgba(255,255,255,0) 18%, rgba(255,255,255,.18) 21%, rgba(255,255,255,0) 24.5%)",
            "radial-gradient(circle at 50% 44%, rgba(0,0,0,0) 26%, rgba(0,0,0,.10) 29%, rgba(0,0,0,0) 32%)",
            "radial-gradient(circle at 50% 44%, rgba(255,255,255,0) 34%, rgba(255,255,255,.15) 37.5%, rgba(255,255,255,0) 41%)",
            "radial-gradient(circle at 50% 44%, rgba(0,0,0,0) 44%, rgba(0,0,0,.10) 47.5%, rgba(0,0,0,0) 51%)",
            "radial-gradient(circle at 50% 44%, rgba(255,255,255,0) 53%, rgba(255,255,255,.11) 56.5%, rgba(255,255,255,0) 60%)",
            "radial-gradient(circle at 50% 44%, rgba(0,0,0,0) 63%, rgba(0,0,0,.12) 67%, rgba(0,0,0,0) 71%)",
            "radial-gradient(circle at 50% 44%, rgba(255,255,255,0) 73%, rgba(255,255,255,.08) 76.5%, rgba(255,255,255,0) 80%)",
          ].join(", "),
        }}
      />
      {animate && (
        <>
          <div className="absolute left-1/2 top-[44%] h-[900px] w-[900px] -ml-[450px] -mt-[450px] animate-[ripple_9s_ease-out_infinite] rounded-full border-2 border-[rgba(255,255,255,.30)]" />
          <div
            className="absolute left-1/2 top-[44%] h-[900px] w-[900px] -ml-[450px] -mt-[450px] animate-[ripple_9s_ease-out_infinite] rounded-full border-2 border-[rgba(255,255,255,.22)]"
            style={{ animationDelay: "4.5s" }}
          />
        </>
      )}
    </div>
  );
}
