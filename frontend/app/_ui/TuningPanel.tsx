"use client";

import { useState } from "react";

/**
 * A development overlay of sliders and switches (DESIGN.md §3.1, §6.16).
 *
 * The panel is generic and is shared by more than one route, thus it is
 * not in one of them. Three surfaces now need hand tuning: the
 * background water of the dashboard, its spectrogram visualizer and the
 * particle sphere on `/particles`. Each of them was going to get its own
 * copy, in addition to the copy that `/demo` has. The differences are a
 * title, a table of knobs and the corner to sit in. The other parts, the
 * collapse, the reset and the number of decimals for a step, are the
 * same panel again.
 *
 * The panel does not use the style of the dashboard. The 10-foot UI has
 * no controls (§8), thus you switch the panel on to tune, then switch it
 * off again, and it must look like the tool that it is.
 *
 * Its sliders are safe beside the global D-pad, because `KeyboardNav`
 * ignores each event whose target is an `<input>`.
 */

export interface TuningSpec {
  label: string;
  min: number;
  max: number;
  step: number;
  /** Shown before the fold. The other knobs are behind the disclosure. */
  primary?: boolean;
  /**
   * How far this knob wanders when the drift is on, relative to the drift
   * rate (`useDrift`). A value of 1, or no value, obeys the rate exactly.
   * A value of 0.5 moves half as far. A value of 0 does not move. Density
   * knobs jump badly if they wander, thus each spec gives its own limit.
   */
  driftScale?: number;
  hint: string;
}

/** A simple on/off row, for controls that are not a number. */
export interface TuningSwitch {
  label: string;
  value: boolean;
  hint: string;
  onChange: (value: boolean) => void;
}

/** Decimals necessary to show the step: 0.005 needs 3, and 1 needs none. */
function decimalsFor(step: number) {
  return Math.max(0, Math.ceil(-Math.log10(step)));
}

function Slider<K extends string>({
  name,
  spec,
  value,
  onChange,
}: {
  name: K;
  spec: TuningSpec;
  value: number;
  onChange: (key: K, value: number) => void;
}) {
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
        onChange={(event) => onChange(name, event.target.valueAsNumber)}
        className="mt-0.5 h-1 w-full cursor-pointer appearance-none rounded-full bg-zinc-700 accent-cyan-400"
      />
    </label>
  );
}

export function TuningPanel<K extends string>({
  title,
  specs,
  order,
  values,
  onChange,
  onReset,
  switches,
  side = "left",
}: {
  title: string;
  specs: Record<K, TuningSpec>;
  /** Which knobs to show, in order. */
  order: readonly K[];
  values: Record<K, number>;
  onChange: (key: K, value: number) => void;
  onReset: () => void;
  /** Optional on/off rows. The panel shows them above the sliders. */
  switches?: TuningSwitch[];
  /** The corner to sit in, thus two panels can be open at the same time. */
  side?: "left" | "right";
}) {
  const [open, setOpen] = useState(true);
  const [showDetail, setShowDetail] = useState(false);
  const corner = side === "left" ? "left-2" : "right-2";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`fixed ${corner} top-2 z-50 rounded border border-white/15 bg-black/60 px-2 py-1 font-mono text-[11px] text-zinc-300 backdrop-blur hover:text-white`}
      >
        {title}
      </button>
    );
  }

  const primary = order.filter((key) => specs[key].primary);
  const detail = order.filter((key) => !specs[key].primary);

  return (
    <aside
      className={`fixed ${corner} top-2 z-50 max-h-[calc(100vh-1rem)] w-56 overflow-y-auto rounded-lg border border-white/10 bg-black/60 p-2.5 text-zinc-200 shadow-xl backdrop-blur`}
    >
      <div className="flex items-baseline justify-between">
        <h2 className="font-mono text-[11px] uppercase tracking-wide text-white">
          {title}
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
            aria-label={`Hide ${title} controls`}
          >
            hide
          </button>
        </div>
      </div>

      {switches && switches.length > 0 && (
        <div className="mt-2 space-y-0.5 border-t border-white/10 pt-2">
          {switches.map((option) => (
            <label
              key={option.label}
              title={option.hint}
              className="flex cursor-pointer items-center gap-2 py-0.5 text-[11px] text-zinc-300"
            >
              <input
                type="checkbox"
                checked={option.value}
                onChange={(event) => option.onChange(event.target.checked)}
                className="h-3.5 w-3.5 accent-cyan-400"
              />
              {option.label}
            </label>
          ))}
        </div>
      )}

      <div className="mt-2 space-y-2 border-t border-white/10 pt-2">
        {primary.map((key) => (
          <Slider
            key={key}
            name={key}
            spec={specs[key]}
            value={values[key]}
            onChange={onChange}
          />
        ))}
      </div>

      {detail.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowDetail((shown) => !shown)}
            className="mt-2 w-full border-t border-white/10 pt-1.5 text-left text-[10px] uppercase tracking-wide text-zinc-400 hover:text-zinc-200"
            aria-expanded={showDetail}
          >
            {showDetail ? "- " : "+ "}
            more
          </button>
          {showDetail && (
            <div className="mt-1.5 space-y-2">
              {detail.map((key) => (
                <Slider
                  key={key}
                  name={key}
                  spec={specs[key]}
                  value={values[key]}
                  onChange={onChange}
                />
              ))}
            </div>
          )}
        </>
      )}
    </aside>
  );
}
