"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { ParticleField, type LevelHistory } from "@/app/_particles/ParticleField";
import { VISUALIZER_BANDS } from "./visualizer-styles";

/**
 * The grid visualizer (DESIGN.md §6.16): the spectrum as a landscape of
 * points that the view sways around.
 *
 * The scene is the grid view of `/particles`, shared from
 * `app/_particles/ParticleField.tsx` and not written again, as the curl
 * field and the core are. Only the source differs. There the data is an
 * offline transform of a decoded preview, whose whole window exists
 * before the scene starts and which a scrub moves. Here it is the live
 * analyser, which gives one slice at a time and no past. Thus this
 * component owns the past: it keeps a ring and pushes one row into it
 * at a constant rate, and the scene draws that ring.
 *
 * It lays down **one row for each frame**, which the spectrogram
 * deliberately does not do (§6.16). The two displays fail in opposite
 * directions. The spectrogram is a stack of separate polylines that a
 * viewer reads as discrete history, thus a fixed 70 ms makes its depth
 * a known interval of time. This landscape is one surface, and a new
 * row moves all of it: at 70 ms the whole image jumps in fourteen steps
 * a second, which reads as the visualizer running at fourteen frames a
 * second whatever the renderer is doing. `/particles`, where the same
 * scene looks smooth, advances a slice every 5.8 ms.
 *
 * A row for each frame is also the rate of the source. The analyser
 * gives one reading a frame, thus a faster rate would repeat rows and a
 * slower one throws readings away. The cost of that rate is that the
 * depth of the landscape is a frame count and not an interval: about
 * 1.6 s at 60 fps, less on a slower machine. That is the honest trade
 * here, because the motion is what the display is for.
 *
 * This is the second reading of the same band array, not a second
 * analyser: the player passes the one array it already fills, and this
 * code copies a row out of it.
 */

/**
 * Slices of history the landscape holds, thus near 1.6 s at 60 fps.
 * It is also the density of the time axis: 96 rows over the depth of
 * the cloud is close to what `/particles` draws.
 */
const ROWS = 96;

export function GridVisualizer({
  paused = false,
  spectrum,
  className,
}: {
  paused?: boolean;
  /** The live levels, 0..1 for each band. It is mutated in place. */
  spectrum?: Float32Array;
  className?: string;
}) {
  const spectrumRef = useRef(spectrum);
  useEffect(() => {
    spectrumRef.current = spectrum;
  });

  // One ring for the life of the tile. A new object here would rebuild
  // the scene, thus the history must not be state and must not be a new
  // literal at each render.
  const history = useMemo<LevelHistory>(
    () => ({
      frames: ROWS,
      bands: VISUALIZER_BANDS,
      levels: new Float32Array(ROWS * VISUALIZER_BANDS),
      head: 0,
      version: 0,
    }),
    [],
  );

  const advance = useCallback(() => {
    // `head` is the newest row, thus move first and then write. The
    // scene calls this one time a frame and not at all while it is
    // paused, thus the ring holds and the landscape freezes with the
    // audio.
    history.head = (history.head + 1) % history.frames;
    const base = history.head * history.bands;
    const source = spectrumRef.current;
    for (let band = 0; band < history.bands; band++) {
      history.levels[base + band] = source?.[band] ?? 0;
    }
    history.version++;
  }, [history]);

  return (
    <ParticleField
      history={history}
      advance={advance}
      // A 10-foot UI has no pointer to give a canvas (§8), thus the view
      // sways on its own instead of orbiting under a drag.
      orbit={false}
      paused={paused}
      className={className}
    />
  );
}
