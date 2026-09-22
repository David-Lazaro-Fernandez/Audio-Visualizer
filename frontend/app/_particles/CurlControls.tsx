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
 * The tuning overlay of the curl field.
 *
 * The panel reads the store and also writes to it. The drift moves the
 * values without input, and a panel that showed only its own writes
 * would show values that are no longer true. Thus the store is the one
 * source of truth and this component subscribes to it. The sliders are a
 * view of the store and not a copy.
 *
 * The panel does not run the drift. It only switches it. The walk belongs
 * to the scene, because the dashboard shows the field with no overlay and
 * the field must still breathe there.
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
