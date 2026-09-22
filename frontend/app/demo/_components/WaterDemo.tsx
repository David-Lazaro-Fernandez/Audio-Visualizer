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
 * Connects the slider panel to the live three.js scene.
 *
 * React owns the numbers, because the panel must print them and the
 * reset button must restore them. React does not own the simulation. The
 * code builds the scene one time and writes each change into the uniform
 * objects that the scene holds. Thus a slider does not remount the
 * canvas and does not recompile a shader. Commands that are events and
 * not state, such as drop now and clear the water, go in the other
 * direction through `apiRef`.
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
