"use client";

import { useState } from "react";
import { useBladeNav } from "./BladeNavContext";
import { bladeTransition } from "./blade-motion";
import type { SectionGradient } from "./blade-gradient";
import {
  BladeSurface,
  BladeSurfacePaintedProvider,
  useBladeSurfacePainted,
} from "./BladeSurface";

/**
 * DESIGN.md §3 Materiality: a soft concentric sheen baked into the radial
 * background, plus 2 looping ripple rings that "propagate from the center"
 * like waves. The sheen is white and black at low alpha, so it works over
 * any section color.
 *
 * This is the **CSS fallback** for those two layers. Where WebGL2 is
 * available `BladeSurface` supersedes both with a real water sheet
 * (§3.1) whose drops and swell do the same job physically, so whenever
 * the shader is live this renders nothing. It stays because the shader is
 * an upgrade, not a dependency: before hydration, without WebGL2, or
 * after a lost context, this is where the blade's materiality comes from
 * — the design the dashboard was built around, not a broken blade.
 */
export function BladeBackground({
  animate = true,
  clip = true,
}: {
  animate?: boolean;
  /** Clip to the blade panel curve (default). Full-screen surfaces pass false. */
  clip?: boolean;
}) {
  const { geometry } = useBladeNav();
  const painted = useBladeSurfacePainted();
  if (painted) return null;
  return (
    // Clipped to the open blade's panel curve so the waves stay on the
    // active blade and don't spill onto the collapsed tab gutters. Rendered
    // above BladeEdges' opaque gradient, otherwise the rings would be hidden
    // beneath it. The clip glides with the panel on a blade switch (§7.4).
    <div
      className="blade-motion pointer-events-none absolute inset-0"
      style={
        clip
          ? { clipPath: geometry.clipPath, transition: bladeTransition("clip-path") }
          : undefined
      }
    >
      <div
        className="absolute inset-0"
        style={{
          // Concentric light/dark bands so the waves actually read against
          // the base color. Alternating bright + shadow rings, fading out
          // toward the edges. Fallback-only now: the shader draws a water
          // sheet instead (§3.1), so there is no twin to keep in step.
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

/**
 * The materiality layer for a full-screen surface (§5.4), which renders
 * "the same background unclipped" but has no panel and so no curve to
 * mask to.
 *
 * Each surface is its own portal outside the canvas, so it owns its own
 * shader and its own fallback verdict rather than inheriting the blade's
 * — hence the local provider. The surface's root keeps its CSS
 * `background` underneath as the floor, exactly as the blade canvas does.
 */
export function BladeScreenSurface({ gradient }: { gradient: SectionGradient }) {
  const [painted, setPainted] = useState(false);
  return (
    <BladeSurfacePaintedProvider painted={painted}>
      <BladeSurface gradient={gradient} onPaintedChange={setPainted} />
      <BladeBackground clip={false} />
    </BladeSurfacePaintedProvider>
  );
}
