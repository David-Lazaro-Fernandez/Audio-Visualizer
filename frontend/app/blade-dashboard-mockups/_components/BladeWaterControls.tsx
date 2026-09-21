"use client";

import { useState } from "react";
import {
  BLADE_WATER_DEFAULTS,
  BLADE_WATER_KEYS,
  BLADE_WATER_SPECS,
  resetBladeWaterControls,
  setBladeWaterControl,
  type BladeWaterKey,
  type BladeWaterState,
} from "./blade-water-controls";

/** Enough decimals to show the step: 0.005 needs 3, a step of 1 needs none. */
function decimalsFor(step: number) {
  return Math.max(0, Math.ceil(-Math.log10(step)));
}

function Slider({
  paramKey,
  value,
  onChange,
}: {
  paramKey: BladeWaterKey;
  value: number;
  onChange: (key: BladeWaterKey, value: number) => void;
}) {
  const spec = BLADE_WATER_SPECS[paramKey];
  return (
    <label className="block" title={spec.hint}>
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-zinc-300">{spec.label}</span>
        <span className="font-mono text-[11px] tabular-nums text-cyan-300">
          {value.toFixed(decimalsFor(spec.step))}
        </span>
      </span>
      <input
        type="range"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={value}
        onChange={(event) => onChange(paramKey, event.target.valueAsNumber)}
        className="mt-0.5 h-1 w-full cursor-pointer appearance-none rounded-full bg-zinc-700 accent-cyan-400"
      />
    </label>
  );
}

/**
 * Live tuning for the background water (DESIGN.md §3.1) - the bank of the
 * sheet, how hard its relief pushes into the section gradient, and the
 * wave model itself.
 *
 * A development overlay, not part of the dashboard: the 10-foot UI has no
 * controls, and this deliberately does not try to look like it belongs.
 * It is collapsible so it can be pushed out of the way while judging the
 * result, and every value writes straight into the live uniforms
 * (`blade-water-controls.ts`), so nothing here remounts a canvas or
 * recompiles a shader.
 *
 * Its sliders are safe next to the global D-pad: `KeyboardNav` bails out
 * on any event whose target is an `<input>`, so arrow keys nudge the
 * slider under the cursor without also flipping blades.
 */
export function BladeWaterControls() {
  // The store is the source of truth for the renderers; this copy exists
  // only so the panel can print the numbers and reset them.
  const [values, setValues] = useState<BladeWaterState>({
    ...BLADE_WATER_DEFAULTS,
  });
  const [open, setOpen] = useState(true);
  const [showDetail, setShowDetail] = useState(false);

  const onChange = (key: BladeWaterKey, value: number) => {
    setBladeWaterControl(key, value);
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const onReset = () => {
    resetBladeWaterControls();
    setValues({ ...BLADE_WATER_DEFAULTS });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-2 top-2 z-50 rounded border border-white/15 bg-black/60 px-2 py-1 font-mono text-[11px] text-zinc-300 backdrop-blur hover:text-white"
      >
        water
      </button>
    );
  }

  const primary = BLADE_WATER_KEYS.filter(
    (key) => BLADE_WATER_SPECS[key].primary,
  );
  const detail = BLADE_WATER_KEYS.filter(
    (key) => !BLADE_WATER_SPECS[key].primary,
  );

  return (
    <aside className="fixed left-2 top-2 z-50 max-h-[calc(100vh-1rem)] w-56 overflow-y-auto rounded-lg border border-white/10 bg-black/60 p-2.5 text-zinc-200 shadow-xl backdrop-blur">
      <div className="flex items-baseline justify-between">
        <h2 className="font-mono text-[11px] uppercase tracking-wide text-white">
          water
        </h2>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={onReset}
            className="text-[11px] text-zinc-400 hover:text-white"
          >
            reset
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-[11px] text-zinc-400 hover:text-white"
            aria-label="Hide water controls"
          >
            hide
          </button>
        </div>
      </div>

      <div className="mt-2 space-y-2 border-t border-white/10 pt-2">
        {primary.map((key) => (
          <Slider
            key={key}
            paramKey={key}
            value={values[key]}
            onChange={onChange}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setShowDetail((shown) => !shown)}
        className="mt-2 w-full border-t border-white/10 pt-1.5 text-left text-[10px] uppercase tracking-wide text-zinc-400 hover:text-zinc-200"
        aria-expanded={showDetail}
      >
        {showDetail ? "- " : "+ "}
        model detail
      </button>
      {showDetail && (
        <div className="mt-1.5 space-y-2">
          {detail.map((key) => (
            <Slider
              key={key}
              paramKey={key}
              value={values[key]}
              onChange={onChange}
            />
          ))}
        </div>
      )}
    </aside>
  );
}
