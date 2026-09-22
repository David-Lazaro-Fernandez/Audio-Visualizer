"use client";

import { useState } from "react";
import {
  WATER_PARAMS,
  type WaterParamKey,
  type WaterToggles,
} from "./water-params";

/**
 * The slider panel (spec section 9). It is written here and does not use
 * lil-gui from a CDN. The project has React and Tailwind, and a
 * controlled `<input type="range">` is all that the panel needs.
 *
 * Each change goes directly into the live uniform objects, thus the
 * simulation does not pause and no shader is recompiled. The panel keeps
 * React state only to print the current numbers.
 *
 * The panel shows the knobs with the highest priority first. The other
 * parts of the model are behind a disclosure, thus the panel does not
 * hide the first knobs.
 */

const PARAM_KEYS = Object.keys(WATER_PARAMS) as WaterParamKey[];
const PRIMARY = PARAM_KEYS.filter((k) => "primary" in WATER_PARAMS[k]);
const ADVANCED = PARAM_KEYS.filter((k) => !("primary" in WATER_PARAMS[k]));

const TOGGLE_LABELS: Record<keyof WaterToggles, { label: string; hint: string }> = {
  heightView: {
    label: "Height / contour view",
    hint: "Swap the glossy shading for a height ramp with contour lines",
  },
  dispersion: {
    label: "Dispersion",
    hint: "Sum 4 wavenumbers so short capillary waves outrun long ones",
  },
  wireframe: {
    label: "Wireframe overlay",
    hint: "Trace the displaced geometry with a coarse 128x128 grid",
  },
  autoDrops: {
    label: "Auto drops",
    hint: "Keep dropping on a timer as well as on click",
  },
};

function Slider({
  paramKey,
  value,
  onChange,
}: {
  paramKey: WaterParamKey;
  value: number;
  onChange: (key: WaterParamKey, value: number) => void;
}) {
  const spec = WATER_PARAMS[paramKey];
  // A step of 0.0005 needs 4 decimals. A step of 1 needs none.
  const decimals = Math.max(0, Math.ceil(-Math.log10(spec.step)));
  return (
    <label className="block" title={spec.hint}>
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] text-zinc-300">{spec.label}</span>
        <span className="font-mono text-[12px] tabular-nums text-cyan-300">
          {value.toFixed(decimals)}
        </span>
      </span>
      <input
        type="range"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={value}
        onChange={(event) => onChange(paramKey, event.target.valueAsNumber)}
        className="mt-1 h-1 w-full cursor-pointer appearance-none rounded-full bg-zinc-700 accent-cyan-400"
      />
    </label>
  );
}

function Toggle({
  toggleKey,
  value,
  onChange,
}: {
  toggleKey: keyof WaterToggles;
  value: boolean;
  onChange: (key: keyof WaterToggles, value: boolean) => void;
}) {
  const { label, hint } = TOGGLE_LABELS[toggleKey];
  return (
    <label
      className="flex cursor-pointer items-center gap-2 py-0.5 text-[12px] text-zinc-300"
      title={hint}
    >
      <input
        type="checkbox"
        checked={value}
        onChange={(event) => onChange(toggleKey, event.target.checked)}
        className="h-3.5 w-3.5 accent-cyan-400"
      />
      {label}
    </label>
  );
}

export function ControlPanel({
  params,
  toggles,
  onParam,
  onToggle,
  onDrop,
  onClear,
  onReset,
}: {
  params: Record<WaterParamKey, number>;
  toggles: WaterToggles;
  onParam: (key: WaterParamKey, value: number) => void;
  onToggle: (key: keyof WaterToggles, value: boolean) => void;
  onDrop: () => void;
  onClear: () => void;
  onReset: () => void;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  return (
    <aside className="pointer-events-auto absolute right-3 top-3 z-10 max-h-[calc(100%-1.5rem)] w-64 overflow-y-auto rounded-lg border border-white/10 bg-black/55 p-3 text-zinc-200 shadow-xl backdrop-blur">
      <h2 className="text-[13px] font-semibold tracking-wide text-white">
        Water drop
      </h2>
      <p className="mt-0.5 text-[11px] leading-snug text-zinc-400">
        Click the surface to drop. Drag to orbit, scroll to zoom.
      </p>

      <div className="mt-3 flex gap-1.5">
        <button
          type="button"
          onClick={onDrop}
          className="flex-1 rounded border border-cyan-400/30 bg-cyan-400/15 px-2 py-1 text-[12px] text-cyan-200 hover:bg-cyan-400/25"
        >
          Drop
        </button>
        <button
          type="button"
          onClick={onClear}
          className="flex-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-[12px] hover:bg-white/10"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={onReset}
          className="flex-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-[12px] hover:bg-white/10"
        >
          Reset
        </button>
      </div>

      <div className="mt-3 space-y-0.5 border-t border-white/10 pt-2">
        {(Object.keys(TOGGLE_LABELS) as (keyof WaterToggles)[]).map((key) => (
          <Toggle
            key={key}
            toggleKey={key}
            value={toggles[key]}
            onChange={onToggle}
          />
        ))}
      </div>

      <div className="mt-3 space-y-2.5 border-t border-white/10 pt-2.5">
        {PRIMARY.map((key) => (
          <Slider
            key={key}
            paramKey={key}
            value={params[key]}
            onChange={onParam}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced((open) => !open)}
        className="mt-3 w-full border-t border-white/10 pt-2 text-left text-[11px] uppercase tracking-wide text-zinc-400 hover:text-zinc-200"
        aria-expanded={showAdvanced}
      >
        {showAdvanced ? "- " : "+ "}
        Model detail
      </button>
      {showAdvanced && (
        <div className="mt-2 space-y-2.5">
          {ADVANCED.map((key) => (
            <Slider
              key={key}
              paramKey={key}
              value={params[key]}
              onChange={onParam}
            />
          ))}
        </div>
      )}
    </aside>
  );
}
