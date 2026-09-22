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
 * The tuning overlay of the spectrogram (DESIGN.md §6.16). The Music
 * Player mounts it only while the spectrogram is the visualizer on the
 * screen, thus it never covers the other visualizers.
 *
 * The React state here lets the panel print the numbers and reset them.
 * The scene reads the store directly, thus a slider drag does not render
 * the player 60 times.
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
