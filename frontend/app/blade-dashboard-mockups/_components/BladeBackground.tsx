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
 * Materiality, DESIGN.md §3: a soft concentric sheen in the radial
 * background, with two ripple rings that repeat and appear to move out
 * from the centre as waves do. The sheen is white and black at a low
 * alpha, thus it works over each section colour.
 *
 * This component is the CSS fallback for those two layers. Where WebGL2
 * is available, `BladeSurface` replaces both with a water sheet (§3.1)
 * whose drops and swell do the same work physically. Thus this component
 * renders nothing while the shader is live. It stays because the shader
 * is an upgrade and not a dependency: before the hydration, with no
 * WebGL2, or after a lost context, this component gives the blade its
 * materiality. It is the design of the dashboard and not a broken blade.
 */
export function BladeBackground({
  animate = true,
  clip = true,
}: {
  animate?: boolean;
  /** Clip to the curve of the blade panel. A full-screen surface passes false. */
  clip?: boolean;
}) {
  const { geometry } = useBladeNav();
  const painted = useBladeSurfacePainted();
  if (painted) return null;
  return (
    // Clipped to the panel curve of the open blade, thus the waves stay
    // on the active blade and do not go onto the collapsed tab gutters.
    // It renders above the opaque gradient of BladeEdges, or that
    // gradient would hide the rings. The clip glides with the panel
    // during a blade switch (§7.4).
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
          // Concentric light and dark bands, thus the waves are visible
          // against the base colour. The bright rings and the shadow
          // rings alternate and fade out toward the edges. This is now a
          // fallback only: the shader draws a water sheet (§3.1), thus
          // there is no twin layer to keep equal.
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
 * The materiality layer of a full-screen surface (§5.4). It renders the
 * same background without a clip, because the surface has no panel and
 * thus no curve to mask to.
 *
 * Each surface is its own portal outside the canvas, thus it owns its
 * shader and its own fallback decision and does not use those of the
 * blade. This is the reason for the local provider. The root of the
 * surface keeps its CSS `background` below as the floor, as the blade
 * canvas does.
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
