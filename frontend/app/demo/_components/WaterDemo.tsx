"use client";

import { useCallback, useRef, useState } from "react";
import { ControlPanel } from "./ControlPanel";
import { WaterSurface, type WaterSceneApi } from "./WaterSurface";
import {
  TOGGLE_DEFAULTS,
  WATER_DEFAULTS,
  type WaterParamKey,
  type WaterToggles,
} from "./water-params";

/**
 * Wires the slider panel to the live three.js scene.
 *
 * React owns the *numbers*, because the panel has to print them and the
 * reset button has to restore them. It does not own the simulation: the
 * scene is built once and every change is written into the uniform
 * objects it already holds, so moving a slider never remounts the canvas
 * or recompiles a shader. Commands that are events rather than state
 * (drop now, clear the water) go the other way, through `apiRef`.
 */
export function WaterDemo() {
  const [params, setParams] = useState<Record<WaterParamKey, number>>(() => ({
    ...WATER_DEFAULTS,
  }));
  const [toggles, setToggles] = useState<WaterToggles>(TOGGLE_DEFAULTS);
  const apiRef = useRef<WaterSceneApi | null>(null);

  const onParam = useCallback((key: WaterParamKey, value: number) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  const onToggle = useCallback((key: keyof WaterToggles, value: boolean) => {
    setToggles((prev) => ({ ...prev, [key]: value }));
  }, []);

  const onDrop = useCallback(() => apiRef.current?.drop(), []);
  const onClear = useCallback(() => apiRef.current?.clear(), []);
  const onReset = useCallback(() => {
    setParams({ ...WATER_DEFAULTS });
    setToggles(TOGGLE_DEFAULTS);
  }, []);

  return (
    <div className="relative flex-1 overflow-hidden">
      <WaterSurface params={params} toggles={toggles} apiRef={apiRef} />
      <ControlPanel
        params={params}
        toggles={toggles}
        onParam={onParam}
        onToggle={onToggle}
        onDrop={onDrop}
        onClear={onClear}
        onReset={onReset}
      />
    </div>
  );
}
