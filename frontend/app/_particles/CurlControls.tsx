"use client";

import { useEffect, useState } from "react";
import { TuningPanel } from "@/app/_ui/TuningPanel";
import {
  CURL_DEFAULTS,
  CURL_DRIFT_MS,
  CURL_KEYS,
  CURL_SPECS,
  curlDrifting,
  curlState,
  resetCurlControls,
  setCurlControl,
  setCurlDrifting,
  subscribeCurl,
  subscribeCurlDrifting,
  type CurlKey,
  type CurlState,
} from "./curl-controls";

/**
 * The curl field's tuning overlay.
 *
 * The panel **reads** the store as well as writing to it: drift moves
 * the values on its own, and a panel that mirrored only its own writes
 * would show numbers that were no longer true. So the store is the
 * single source of truth and this subscribes to it — the sliders are a
 * view of it rather than a copy.
 *
 * It does not *run* the drift, only switches it. The walk belongs to the
 * scene, because the dashboard shows the field with no overlay at all
 * and it still has to breathe there.
 */
export function CurlControls() {
  const [values, setValues] = useState<CurlState>(() => ({ ...curlState() }));
  const [drifting, setDrifting] = useState(curlDrifting);

  useEffect(() => subscribeCurl((next) => setValues({ ...next })), []);
  useEffect(() => subscribeCurlDrifting(setDrifting), []);

  return (
    <TuningPanel
      title="curl"
      side="right"
      specs={CURL_SPECS}
      order={CURL_KEYS}
      values={values}
      onChange={(key: CurlKey, value: number) => setCurlControl(key, value)}
      onReset={() => {
        resetCurlControls();
        setValues({ ...CURL_DEFAULTS });
      }}
      switches={[
        {
          label: `Drift every ${CURL_DRIFT_MS / 1000}s`,
          value: drifting,
          hint: "Walk each knob up and down on its own, within the range its spec allows",
          onChange: setCurlDrifting,
        },
      ]}
    />
  );
}
