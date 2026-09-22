"use client";

import { useEffect, useState } from "react";
import { TuningPanel } from "@/app/_ui/TuningPanel";
import {
  RAYMARCH_DEFAULTS,
  RAYMARCH_DRIFT_MS,
  RAYMARCH_KEYS,
  RAYMARCH_SPECS,
  raymarchDrifting,
  raymarchState,
  resetRaymarchControls,
  setRaymarchControl,
  setRaymarchDrifting,
  subscribeRaymarch,
  subscribeRaymarchDrifting,
  type RaymarchKey,
  type RaymarchState,
} from "./raymarch-controls";

/**
 * The tuning overlay of the raymarched core.
 *
 * It has the same structure and the same reasons as the curl panel. The
 * store is the one source of truth. This component subscribes to it,
 * thus the sliders follow the drift and do not show old copies of their
 * own writes. The walk runs in the scene, thus the field also breathes
 * where the panel is hidden.
 */
export function RaymarchControls() {
  const [values, setValues] = useState<RaymarchState>(() => ({ ...raymarchState() }));
  const [drifting, setDrifting] = useState(raymarchDrifting);

  useEffect(() => subscribeRaymarch((next) => setValues({ ...next })), []);
  useEffect(() => subscribeRaymarchDrifting(setDrifting), []);

  return (
    <TuningPanel
      title="raymarch"
      side="right"
      specs={RAYMARCH_SPECS}
      order={RAYMARCH_KEYS}
      values={values}
      onChange={(key: RaymarchKey, value: number) => setRaymarchControl(key, value)}
      onReset={() => {
        resetRaymarchControls();
        setValues({ ...RAYMARCH_DEFAULTS });
      }}
      switches={[
        {
          label: `Drift every ${RAYMARCH_DRIFT_MS / 1000}s`,
          value: drifting,
          hint: "Walk each knob up and down on its own, within the range its spec allows",
          onChange: setRaymarchDrifting,
        },
      ]}
    />
  );
}
