"use client";

import { useState } from "react";
import { TuningPanel } from "@/app/_ui/TuningPanel";
import {
  SPHERE_DEFAULTS,
  SPHERE_KEYS,
  SPHERE_SPECS,
  resetSphereControls,
  setSphereControl,
  type SphereKey,
  type SphereState,
} from "./sphere-controls";

/**
 * The particle sphere's tuning overlay, mounted only while the sphere is
 * the view on screen.
 *
 * React state here is only so the panel can print the numbers and reset
 * them; the scene reads the store directly, which is what keeps a slider
 * drag from re-rendering the page sixty times.
 */
export function SphereControls() {
  const [values, setValues] = useState<SphereState>({ ...SPHERE_DEFAULTS });

  return (
    <TuningPanel
      title="sphere"
      side="right"
      specs={SPHERE_SPECS}
      order={SPHERE_KEYS}
      values={values}
      onChange={(key: SphereKey, value: number) => {
        setSphereControl(key, value);
        setValues((prev) => ({ ...prev, [key]: value }));
      }}
      onReset={() => {
        resetSphereControls();
        setValues({ ...SPHERE_DEFAULTS });
      }}
    />
  );
}
