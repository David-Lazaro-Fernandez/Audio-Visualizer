"use client";

import { useState } from "react";
import { TuningPanel } from "@/app/_ui/TuningPanel";
import {
  BLADE_WATER_DEFAULTS,
  BLADE_WATER_KEYS,
  BLADE_WATER_SPECS,
  resetBladeWaterControls,
  setBladeWaterControl,
  type BladeWaterKey,
  type BladeWaterState,
} from "./blade-water-controls";

/**
 * Live tuning for the background water (DESIGN.md §3.1): the bank of the
 * sheet, the strength of its relief on the section gradient, and the
 * wave model.
 *
 * It is off by default (`SHOW_WATER_CONTROLS`). The 10-foot UI has no
 * controls (§8), thus you switch this panel on while you tune. The panel
 * is `TuningPanel`, which the overlay of the spectrogram also uses
 * (§6.16). It sits on the left, thus both panels can be open at the same
 * time.
 *
 * The React state here lets the panel print the numbers and reset them.
 * Each value goes directly into the live uniforms through
 * `blade-water-controls.ts`, thus nothing here remounts a canvas or
 * recompiles a shader.
 */
export function BladeWaterControls() {
  const [values, setValues] = useState<BladeWaterState>({
    ...BLADE_WATER_DEFAULTS,
  });

  return (
    <TuningPanel
      title="water"
      side="left"
      specs={BLADE_WATER_SPECS}
      order={BLADE_WATER_KEYS}
      values={values}
      onChange={(key: BladeWaterKey, value: number) => {
        setBladeWaterControl(key, value);
        setValues((prev) => ({ ...prev, [key]: value }));
      }}
      onReset={() => {
        resetBladeWaterControls();
        setValues({ ...BLADE_WATER_DEFAULTS });
      }}
    />
  );
}
