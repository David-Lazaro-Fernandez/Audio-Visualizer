"use client";

import { useState } from "react";
import { useBladeNav } from "./BladeNavContext";
import { themeVars } from "./blade-theme";
import { gradientCss } from "./blade-gradient";
import { BladeSurface, BladeSurfacePaintedProvider } from "./BladeSurface";
import { useCoveredSurface } from "./surface-stack";

/**
 * The full-bleed blade surface (DESIGN.md §1: the top-level UI expands
 * to fill the centre of the screen). It paints the radial gradient of
 * the open section (§2.1) and sets the text and rule tints of that
 * section as CSS variables (§2.2, `blade-theme.ts`). Thus each part
 * inside, which is the menu rows, the Open Tray and the watermarks,
 * takes the colour of the blade. It also clips the other layers to the
 * canvas.
 *
 * The code paints the gradient two times. The CSS `background` is the
 * floor: it shows before the hydration and where WebGL2 is absent. Above
 * it, `BladeSurface` runs the shader, which also draws the sheen, the
 * ripples and the gloss of §3 and interpolates the colour change of
 * §7.4. The component publishes the result to the subtree, because the
 * layers with a CSS twin must stop drawing when the shader is live. If
 * they did not, the opaque panel fill of `BladeEdges` would cover the
 * canvas.
 */
export function BladeCanvas({ children }: { children: React.ReactNode }) {
  const { active, geometry } = useBladeNav();
  const [painted, setPainted] = useState(false);
  // The blade is the floor: it covers nothing, and any open full-screen
  // surface hides it completely (`surface-stack.ts`).
  const covered = useCoveredSurface(false);
  return (
    <div
      className="relative h-screen w-full overflow-hidden rounded-[6px]"
      style={{
        background: gradientCss(active.gradient),
        ...themeVars(active.theme),
      }}
    >
      <BladeSurface
        gradient={active.gradient}
        panel={{ leftX: geometry.leftX, rightX: geometry.rightX }}
        covered={covered}
        onPaintedChange={setPainted}
      />
      <BladeSurfacePaintedProvider painted={painted}>
        {children}
      </BladeSurfacePaintedProvider>
    </div>
  );
}
