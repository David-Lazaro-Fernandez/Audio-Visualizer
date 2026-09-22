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
 * Live tuning for the background water (DESIGN.md §3.1) — the bank of
 * the sheet, how hard its relief pushes into the section gradient, and
 * the wave model itself.
 *
 * Off by default (`SHOW_WATER_CONTROLS`): the 10-foot UI has no controls
 * (§8), so this is something to switch on while tuning. The panel itself
 * is `TuningPanel`, shared with the spectrogram's overlay (§6.16) and
 * sits on the left so both can be open at once.
 *
 * React state here is only so the panel can print the numbers and reset
 * them. Every value goes straight into the live uniforms through
 * `blade-water-controls.ts`, so nothing here remounts a canvas or
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
