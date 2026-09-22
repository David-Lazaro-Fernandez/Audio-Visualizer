"use client";

import { useState } from "react";
import { TuningPanel } from "@/app/_ui/TuningPanel";
import {
  SPECTROGRAM_DEFAULTS,
  SPECTROGRAM_KEYS,
  SPECTROGRAM_SPECS,
  resetSpectrogramControls,
  setSpectrogramControl,
  type SpectrogramKey,
  type SpectrogramState,
} from "./spectrogram-controls";

/**
 * The spectrogram's tuning overlay (DESIGN.md §6.16). Mounted by the
 * Music Player only while the spectrogram is the visualizer on screen,
 * so it is never in the way of the other four.
 *
 * React state here is only so the panel can print the numbers and reset
 * them; the scene reads the store directly, which is what keeps a slider
 * drag from re-rendering the player sixty times.
 */
export function SpectrogramControls() {
  const [values, setValues] = useState<SpectrogramState>({
    ...SPECTROGRAM_DEFAULTS,
  });

  return (
    <TuningPanel
      title="spectrogram"
      side="right"
      specs={SPECTROGRAM_SPECS}
      order={SPECTROGRAM_KEYS}
      values={values}
      onChange={(key: SpectrogramKey, value: number) => {
        setSpectrogramControl(key, value);
        setValues((prev) => ({ ...prev, [key]: value }));
      }}
      onReset={() => {
        resetSpectrogramControls();
        setValues({ ...SPECTROGRAM_DEFAULTS });
      }}
    />
  );
}
