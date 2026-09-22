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
 * The tuning overlay of the particle sphere. It is mounted only while
 * the sphere is the view on the screen.
 *
 * The React state here lets the panel print the numbers and reset them.
 * The scene reads the store directly, thus a slider drag does not render
 * the page 60 times.
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
