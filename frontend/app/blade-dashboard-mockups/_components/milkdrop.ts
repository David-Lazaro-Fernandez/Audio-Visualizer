/**
 * The parts of MilkDrop that a ported preset needs (DESIGN.md §6.16).
 *
 * `WarpVisualizer.tsx` implements the Geiss screensaver of 1998: a
 * buffer, a field that moves it and a curve drawn over the result.
 * MilkDrop (Ryan Geiss, 1999-2001) is the same loop two years later,
 * with the random field replaced by an authored one. A `.milk` preset
 * is a block of scalars plus two blocks of equations: `per_frame_*`,
 * which run one time for each frame, and `per_pixel_*`, which run for
 * each vertex of a coarse mesh and set the warp for that vertex.
 *
 * This module holds the parts of that engine that no preset owns: the
 * frame that an author writes in, the transform that turns the eight
 * warp variables into a source coordinate, and the audio values that
 * the equations read. A second port reuses this file and adds only its
 * own equations.
 *
 * Each rule here is taken from the engine of BeatDrop
 * (`vis_milk2/milkdropfs.cpp`, BSD 3-Clause), which is the MilkDrop 2
 * source. The line references are to that file.
 *
 * ## Why the warp is in a vertex shader
 *
 * MilkDrop runs the per-pixel block at the vertices of a 32x24 mesh and
 * lets the rasteriser interpolate the source coordinate between them.
 * That is not only an optimisation, it is the look: a preset that asks
 * for a zoom of 0.1 samples ten frame widths away, and neighbouring
 * vertices that disagree give long smeared triangles. An exact
 * evaluation for each fragment is more faithful to the equations and
 * less faithful to the picture; it gives aliased noise where MilkDrop
 * gives a smear. Thus the equations go in the vertex shader of a real
 * mesh, which is both the original semantics and 825 evaluations
 * instead of a million.
 *
 * Use only ASCII characters. Refer to `app/_glsl/noise.ts`.
 */

/** The mesh that the per-pixel equations run on. These are the defaults of MilkDrop. */
export const MESH_X = 32;
export const MESH_Y = 24;

/**
 * The aspect pair of MilkDrop (`plugin.cpp:2399`). The longer axis takes
 * 1.0 and the shorter takes its ratio, which is what makes `rad` a
 * circle in pixels and not an ellipse.
 */
export function milkdropAspect(width: number, height: number): [number, number] {
  return [height > width ? width / height : 1, width > height ? height / width : 1];
}

/**
 * The frame that a preset author writes in (`UvToMathSpace`,
 * `milkdropfs.cpp:5149`) and the warp transform that consumes their
 * answers (`milkdropfs.cpp:2092`).
 *
 * MilkDrop puts v = 0 at the top of its texture and this code puts it at
 * the bottom, thus `mdSpace` takes a flipped copy of the UV and
 * `mdSample` flips the result back. The flip is confined to those two
 * places, so everything between them can be read beside the C++.
 */
export const MILKDROP_CHUNK = /* glsl */ `
uniform vec2 uAspect;

// x and y run 0..1, left to right and TOP to bottom. rad is 0 at the
// centre and exactly 1 at the corners. ang is 0 at three o'clock and
// grows anticlockwise. clip is the -1..1 screen position, y up.
struct MdSpace {
  vec2  clip;
  float x;
  float y;
  float rad;
  float ang;
};

MdSpace mdSpace(vec2 uv) {
  MdSpace s;
  // The UV of MilkDrop, v = 0 at the top.
  vec2 md = vec2(uv.x, 1.0 - uv.y);
  s.clip = vec2(md.x * 2.0 - 1.0, 1.0 - md.y * 2.0);
  s.x = s.clip.x * 0.5 * uAspect.x + 0.5;
  s.y = s.clip.y * -0.5 * uAspect.y + 0.5;
  vec2 p = s.clip * uAspect;
  s.rad = length(p) / length(uAspect);
  s.ang = atan(p.y, p.x);
  return s;
}

// The eight warp variables, applied in the order of the engine: zoom
// about the centre of the frame, stretch and rotation about (cx, cy),
// then translation. The result is a MilkDrop UV.
//
// The warp term of the engine is left out. It is four sines added to
// the coordinate, and every preset that does not use it sets warp to 0;
// Harlequin is one of those. A port that needs it adds it here.
vec2 mdWarp(
  MdSpace s,
  float zoom, float zoomExp, float rot,
  float cx, float cy, float dx, float dy, float sx, float sy
) {
  float zoom2 = pow(zoom, pow(zoomExp, s.rad * 2.0 - 1.0));
  float inv = 1.0 / zoom2;

  float u =  s.clip.x * uAspect.x * 0.5 * inv + 0.5;
  float v = -s.clip.y * uAspect.y * 0.5 * inv + 0.5;

  u = (u - cx) / sx + cx;
  v = (v - cy) / sy + cy;

  float c = cos(rot);
  float n = sin(rot);
  float u2 = u - cx;
  float v2 = v - cy;
  u = u2 * c - v2 * n + cx;
  v = u2 * n + v2 * c + cy;

  u -= dx;
  v -= dy;

  // Undo the aspect fix, thus the coordinate is a texture UV again.
  u = (u - 0.5) / uAspect.x + 0.5;
  v = (v - 0.5) / uAspect.y + 0.5;
  return vec2(u, v);
}

// A MilkDrop UV read from a texture of this code, which is the flip
// that mdSpace applies, undone. The sampler must wrap: a preset with a
// small zoom samples many frame widths away, and the tiling that
// follows is the picture and not an error.
vec2 mdSample(vec2 mdUv) {
  return vec2(mdUv.x, 1.0 - mdUv.y);
}
`;

/**
 * The three audio values that a preset reads, and their attack-decay
 * copies.
 *
 * MilkDrop gives `bass`, `mid` and `treb` on a scale where 1.0 is the
 * usual level of that band for the track that plays, not a fraction of
 * full scale. An equation such as `zoom = zoom + 0.1*bass_att` is
 * written against that convention, thus a port that hands it a 0..1
 * fraction gets a preset that hardly moves. The normaliser here is a
 * slow mean for each band group, exactly for that reason.
 *
 * The `_att` values are the same signal through a rise-fast, fall-slow
 * envelope. A preset uses them where a plain value would flicker.
 */
export interface MilkdropAudio {
  bass: number;
  mid: number;
  treb: number;
  bassAtt: number;
  midAtt: number;
  trebAtt: number;
}

/** Where the three groups sit in the 28 log-spaced bands of `use-audio-spectrum.ts`. */
const GROUPS: [number, number][] = [
  [0, 9],
  [9, 19],
  [19, 28],
];

/** Seconds for the long mean that sets what "1.0" means, and for the two envelopes. */
const MEAN_TAU = 6;
const ATTACK_TAU = 0.04;
const RELEASE_TAU = 0.28;

/** A level under this counts as no signal, and the mean stops learning from it. */
const FLOOR = 0.004;

/** Reading three values from a band array, with the state that the means need. */
export function createMilkdropAudio() {
  const mean = [FLOOR, FLOOR, FLOOR];
  const value = [0, 0, 0];
  const att = [0, 0, 0];

  return (spectrum: Float32Array | undefined, dt: number): MilkdropAudio => {
    for (let group = 0; group < 3; group++) {
      const [from, to] = GROUPS[group];
      let sum = 0;
      if (spectrum && spectrum.length >= to) {
        for (let band = from; band < to; band++) sum += spectrum[band];
      }
      const level = sum / (to - from);

      // The mean follows the level only while there is a signal. A
      // silent passage must not pull the mean down and then report the
      // first note back as ten times the usual level.
      if (level > FLOOR) {
        const k = 1 - Math.exp(-dt / MEAN_TAU);
        mean[group] += (level - mean[group]) * k;
      }

      // 1.0 is the usual level of this band, which is the scale that a
      // preset is written against.
      const scaled = level / Math.max(FLOOR, mean[group]);
      value[group] = scaled;

      const tau = scaled > att[group] ? ATTACK_TAU : RELEASE_TAU;
      att[group] += (scaled - att[group]) * (1 - Math.exp(-dt / tau));
    }

    return {
      bass: value[0],
      mid: value[1],
      treb: value[2],
      bassAtt: att[0],
      midAtt: att[1],
      trebAtt: att[2],
    };
  };
}
