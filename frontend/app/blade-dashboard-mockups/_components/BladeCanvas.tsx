"use client";

import { useState } from "react";
import { useBladeNav } from "./BladeNavContext";
import { themeVars } from "./blade-theme";
import { gradientCss } from "./blade-gradient";
import { BladeSurface, BladeSurfacePaintedProvider } from "./BladeSurface";

/**
 * The full-bleed blade surface (DESIGN.md §1: "the entire top-level UI ...
 * expands to fill the center of the screen"). Paints the open section's
 * signature radial gradient (§2.1) and sets its text/rule tints as CSS
 * variables (§2.2, `blade-theme.ts`) so everything inside — menu rows,
 * Open Tray, watermarks — recolors with the blade. Clips everything else
 * to the canvas.
 *
 * The gradient is painted twice on purpose. The CSS `background` is the
 * floor: it is what shows before hydration and wherever WebGL2 is
 * missing. Over it, `BladeSurface` runs the shader that also carries the
 * §3 sheen, ripples and gloss and interpolates the §7.4 color change for
 * real. Whether that succeeded is published to the subtree, because the
 * layers with a CSS twin have to stand down when it did — otherwise
 * `BladeEdges`' opaque panel fill would simply cover the canvas.
 */
export function BladeCanvas({ children }: { children: React.ReactNode }) {
  const { active, geometry } = useBladeNav();
  const [painted, setPainted] = useState(false);
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
        onPaintedChange={setPainted}
      />
      <BladeSurfacePaintedProvider painted={painted}>
        {children}
      </BladeSurfacePaintedProvider>
    </div>
  );
}
