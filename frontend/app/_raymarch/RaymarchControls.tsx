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
 * The raymarched core's tuning overlay.
 *
 * Same shape and same reasoning as the curl panel: the store is the
 * single source of truth, this subscribes to it so the sliders track the
 * drift instead of showing stale copies of their own writes, and the
 * walk itself lives in the scene so the field still breathes where the
 * panel is hidden.
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
