"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  MESH_X,
  MESH_Y,
  MILKDROP_CHUNK,
  createMilkdropAudio,
  milkdropAspect,
} from "./milkdrop";
import { VISUALIZER_BANDS } from "./visualizer-styles";

/**
 * Harlequin (DESIGN.md §6.16): a MilkDrop preset, ported by hand.
 *
 * `WarpVisualizer.tsx` is the Geiss screensaver of 1998 and rolls its
 * field with dice. MilkDrop is the same loop of 1999 with the dice
 * replaced by an author. This is one of its presets:
 * `!mu$ - Rovastar - Harlequin's Fluid Wallpaper 3.milk`, by Rovastar
 * and mu$, from the 1,000 that BeatDrop ships
 * (`OfficialIncubo/BeatDrop-Music-Visualizer`). It is a MilkDrop 1
 * preset, which is what makes it portable: it carries no `warp_` or
 * `comp_` block, thus there is no HLSL to translate and the whole
 * effect is its equations.
 *
 * ## What it draws
 *
 * `per_pixel_1` splits the frame at `5*rad^3 = 1`, which is a circle at
 * rad 0.585. Inside it the zoom is `1 - 0.4*log(sqrt(2) - rad)`, a
 * smooth lens that runs from 0.86 at the centre to 1.07 at the edge of
 * the circle: a calm suck. Outside it the zoom is `q1*0.1`, near a
 * tenth, thus each pixel out there samples ten frame widths away. The
 * texture wraps (`bTexWrap=1`), so what comes back is the frame tiled
 * ten times over, sheared by a translation of up to 1.3 units and
 * turned by a rotation that follows that translation. That tiling is
 * the harlequin of the name, and the calm lens in the middle of it is
 * the fluid.
 *
 * Into that go three seeds, drawn again at each frame: a 100-sided disc
 * that samples the last frame through a red-to-green gradient (shape 0,
 * and the reason the picture is red and green), a red pinpoint at the
 * centre (shape 1), and the waveform as a slowly turning circle at
 * radius 0.55. An animated 2.5% frame at the border feeds fresh colour
 * in at the edge, where the outer field is waiting to eat it.
 *
 * ## The two deliberate departures
 *
 * Everything above is the preset. Two things are not, and both are for
 * one reason: **the preset does not listen.** Its `per_frame` and
 * `per_pixel` blocks read `time` and nothing else, and `fWaveScale` is
 * 0.01, which flattens the waveform circle to a plain ring. It is a
 * wallpaper, as its name says, and a wallpaper in a music player is a
 * screensaver.
 *
 * - **The circle carries the spectrum.** This is the wave doing the job
 *   that MilkDrop gave it; only the scale that the author turned down
 *   is turned back up. The bands feed it in place of the PCM, as they
 *   do on the ring of `WarpVisualizer`.
 * - **`bass_att` opens the outer zoom.** One term, in the idiom of the
 *   presets that do listen. A kick lifts the outer zoom from 0.1 toward
 *   0.13, the tiling relaxes, and the image surges outward.
 *
 * Nothing else is added. There is no beat clock here: a swap of state
 * on a beat is what `WarpVisualizer` is for, and a preset is one field
 * and not a hand of them.
 *
 * Refer to `milkdrop.ts` for the engine that both this and any second
 * port stand on, and for why the equations run in a vertex shader.
 */

/** The width of the buffer, at most, as on `WarpVisualizer`. */
const MAX_SIDE = 900;

/** The points of the wave circle. MilkDrop draws 256 for wave mode 0. */
const WAVE_POINTS = 256;

/**
 * What is left of a pixel after one frame.
 *
 * The preset asks for `fDecay=1.0`, no decay at all, and relies on the
 * truncation of an 8-bit divide to drain the buffer. This target is
 * half float and has no such loss, thus an exact 1.0 would let the
 * image sit for ever. The value here is the smallest drain that keeps
 * the loop moving.
 */
const DECAY = 0.994;

/** The preset's own scalars, read out of the `.milk` file. */
const ZOOM_EXP = 1.01; // fZoomExponent
const CX0 = 1.159999; // cx, before per_frame_4
const CY0 = 0.5; // cy, before per_frame_5
const IB_SIZE = 0.025; // ib_size; ob_size is 0, thus there is no outer border
const IB0 = 0.2; // ib_r, ib_g and ib_b, before per_frame_7..9
const WAVE_BASE = 0.5 + 0.05; // the 0.5 of wave mode 0, plus fWaveParam

/** How far a full band pushes the wave circle out. Refer to the departures above. */
const WAVE_AMP = 0.3;
/** How far `bass_att` opens the outer zoom, as a fraction of it. */
const BASS_ZOOM = 0.3;

/** Below this mean level the input counts as silence and the idle curve takes over. */
const SILENCE = 0.01;

const TAU = 6.283185307179586;

/**
 * The per-pixel block, at the vertices of the 32x24 mesh.
 *
 * The block is read in order and each line sees what the lines above it
 * left, which is why `per_pixel_6` gets the `dx` of `per_pixel_4` while
 * `per_pixel_4` gets the `rot` of the per-frame block. That detail
 * decides the picture, thus the port keeps the order and names the
 * lines.
 */
const WARP_VERTEX = /* glsl */ `
${MILKDROP_CHUNK}

uniform float uTime;
uniform float uCx;
uniform float uCy;
uniform float uBass;

varying vec2 vSrc;

void main() {
  MdSpace s = mdSpace(uv);
  float t = uTime;
  float x = s.x;
  float y = s.y;
  float rad = s.rad;

  // per_pixel_1
  float circle = 5.0 * rad * rad * rad;

  // per_pixel_2. dx, dy, rot, sx and sy still hold the per-frame values
  // here, which are 0, 0, 0, 1 and 1, thus the four terms that read
  // them are zero and q1 is a function of x, y and time alone. The dead
  // terms are dropped and not carried as zeroes.
  float q1 = 1.3 + 0.1 * rad + 0.5 * (
      sin(0.3 * pow(x, 4.0) + x + 0.3 * t)
    - cos(0.2 * pow(y, 4.0) + y + 0.23 * t)
  );

  bool outer = circle > 1.0;

  // per_pixel_3. The bass term is the second departure: refer to the
  // head of the file.
  float zoom = outer
    ? q1 * 0.1 * (1.0 + uBass)
    : 1.0 - 0.4 * log(1.4142136 - rad);

  // per_pixel_4 and 5. rot is still 0 here; cx is the per-frame value.
  float dx = outer ? 1.3 * sin(0.75 * x + 0.942 * t) : 0.0;
  float dy = outer ? 1.3 * sin(uCx + 0.75 * y + 1.081 * t) : 0.0;

  // per_pixel_6, which reads the dx that per_pixel_4 just wrote.
  float rot = outer ? 0.4 * sin(dx + rad + x * y + 0.812 * t) : 0.01 * rad;

  // per_pixel_7 and 8, which read dy and cy.
  float sy = outer ? 1.0 + 0.03 * sin(dy - rad + (x + y) + 1.21 * t) : 1.0;
  float sx = outer ? 1.0 + 0.03 * sin(uCy + rad + (x - y) + 1.33 * t) : 1.0;

  vSrc = mdSample(mdWarp(s, zoom, ${ZOOM_EXP}, rot, uCx, uCy, dx, dy, sx, sy));
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const WARP_FRAGMENT = /* glsl */ `
uniform sampler2D uPrev;
uniform float uDecay;
varying vec2 vSrc;

void main() {
  // The sampler wraps. A zoom of a tenth reads ten frame widths out,
  // and the tiling that comes back is the effect.
  gl_FragColor = vec4(texture2D(uPrev, vSrc).rgb * uDecay, 1.0);
}
`;

/**
 * A custom shape (`milkdropfs.cpp:2612`): a fan of `sides` triangles
 * about a centre vertex, the rim turned by `ang` and offset by a
 * quarter turn, and the x of every vertex scaled by the shorter aspect
 * so the shape is a circle on the screen. A textured shape carries a
 * second circle of coordinates, turned by `tex_ang` and scaled by one
 * over `tex_zoom`, which is what makes it a rotated copy of the frame.
 */
const SHAPE_VERTEX = /* glsl */ `
uniform vec2  uAspect;
uniform vec2  uCenter;
uniform float uRad;
uniform float uAng;
uniform float uTexAng;
uniform float uTexZoom;

attribute float aT;

varying vec2  vTex;
varying float vRim;

void main() {
  if (aT < 0.0) {
    gl_Position = vec4(uCenter, 0.0, 1.0);
    vTex = vec2(0.5);
    vRim = 0.0;
    return;
  }
  float a = aT * ${TAU} + uAng + 0.7853982;
  vec2 p = uCenter + vec2(uRad * cos(a) * uAspect.y, uRad * sin(a));
  gl_Position = vec4(p, 0.0, 1.0);

  float ta = aT * ${TAU} + uTexAng + 0.7853982;
  vec2 md = vec2(
    0.5 + 0.5 * cos(ta) / uTexZoom * uAspect.y,
    0.5 + 0.5 * sin(ta) / uTexZoom
  );
  vTex = vec2(md.x, 1.0 - md.y);
  vRim = 1.0;
}
`;

const SHAPE_FRAGMENT = /* glsl */ `
uniform sampler2D uTex;
uniform vec4 uColor;
uniform vec4 uColor2;
uniform float uTextured;

varying vec2  vTex;
varying float vRim;

void main() {
  // The centre vertex carries one colour and every rim vertex the
  // other, thus the fan interpolates between them.
  vec4 c = mix(uColor, uColor2, vRim);
  vec3 rgb = c.rgb;
  // Direct3D modulates the texture by the vertex colour, thus a red
  // centre and a green rim recolour the copy of the frame.
  if (uTextured > 0.5) rgb *= texture2D(uTex, vTex).rgb;
  gl_FragColor = vec4(rgb, c.a);
}
`;

/** A line in one flat colour: the outline of a shape, the wave, the border. */
const FLAT_FRAGMENT = /* glsl */ `
uniform vec4 uColor;
void main() { gl_FragColor = uColor; }
`;

const CLIP_VERTEX = /* glsl */ `
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const PRESENT_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const PRESENT_FRAGMENT = /* glsl */ `
uniform sampler2D uImage;
varying vec2 vUv;

void main() {
  // As on Warp: a feedback loop goes past 1 where the seeds cross their
  // own trail, and the shoulder keeps those places coloured instead of
  // clipping them to white.
  vec3 c = texture2D(uImage, vUv).rgb;
  gl_FragColor = vec4(vec3(1.0) - exp(-c * 1.25), 1.0);
}
`;

/** The fan of a shape: a centre vertex, then `sides` rim vertices, wrapped. */
function fanGeometry(sides: number) {
  const t = new Float32Array(sides + 1);
  const position = new Float32Array((sides + 1) * 3);
  t[0] = -1;
  for (let j = 0; j < sides; j++) t[j + 1] = j / sides;
  const index: number[] = [];
  for (let j = 1; j <= sides; j++) index.push(0, j, j === sides ? 1 : j + 1);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("aT", new THREE.BufferAttribute(t, 1));
  geometry.setIndex(index);
  return geometry;
}

/** The rim of that same shape on its own, for the outline. */
function rimGeometry(sides: number) {
  const t = new Float32Array(sides);
  const position = new Float32Array(sides * 3);
  for (let j = 0; j < sides; j++) t[j] = j / sides;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("aT", new THREE.BufferAttribute(t, 1));
  return geometry;
}

/**
 * The inner border (`milkdropfs.cpp:4551`): a frame of four quads
 * between `1 - ib_size` and 1 in clip space, drawn in one colour.
 */
function borderGeometry(size: number) {
  const inner = 1 - size;
  const position = new Float32Array([
    // top
    -1, 1, 0, 1, 1, 0, 1, inner, 0, -1, inner, 0,
    // bottom
    -1, -inner, 0, 1, -inner, 0, 1, -1, 0, -1, -1, 0,
    // left
    -1, inner, 0, -inner, inner, 0, -inner, -inner, 0, -1, -inner, 0,
    // right
    inner, inner, 0, 1, inner, 0, 1, -inner, 0, inner, -inner, 0,
  ]);
  const index: number[] = [];
  for (let q = 0; q < 4; q++) {
    const b = q * 4;
    index.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setIndex(index);
  return geometry;
}

/**
 * Put an object in a scene that has no camera.
 *
 * Every shader here writes clip space itself, thus the vertex data is
 * not where the object is and the bounding sphere that three computes
 * from it is wrong; a fan whose positions are all zero would be culled
 * outright. The order is explicit for the same class of reason: these
 * are transparent objects at one depth, thus three has nothing to sort
 * them by, and MilkDrop draws the shapes, then the wave, then the
 * border.
 */
function place<T extends THREE.Object3D>(object: T, order: number): T {
  object.frustumCulled = false;
  object.renderOrder = order;
  return object;
}

/** `bMaximizeWaveColor`: scale the wave colour so its brightest channel is 1. */
function maximize(r: number, g: number, b: number): [number, number, number] {
  const peak = Math.max(r, g, b, 0.0001);
  return [r / peak, g / peak, b / peak];
}

export function HarlequinVisualizer({
  paused = false,
  spectrum,
  className,
}: {
  paused?: boolean;
  spectrum?: Float32Array;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const spectrumRef = useRef(spectrum);
  spectrumRef.current = spectrum;
  const startRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
    } catch {
      return; // No WebGL2; the tile stays black rather than breaking.
    }
    renderer.setClearColor(0x05040a, 1);
    renderer.autoClear = false;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // One aspect pair, shared by every pass. The warp reads it through
    // `MILKDROP_CHUNK`, the shapes and the wave to stay circular.
    const aspect = new THREE.Vector2(1, 1);

    // --- the warp pass, on the 32x24 mesh of MilkDrop -------------------
    const warpUniforms: Record<string, THREE.IUniform> = {
      uPrev: { value: null },
      uAspect: { value: aspect },
      uTime: { value: 0 },
      uCx: { value: CX0 },
      uCy: { value: CY0 },
      uBass: { value: 0 },
      uDecay: { value: DECAY },
    };
    const warpMaterial = new THREE.ShaderMaterial({
      uniforms: warpUniforms,
      vertexShader: WARP_VERTEX,
      fragmentShader: WARP_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    const warpMesh = new THREE.PlaneGeometry(2, 2, MESH_X, MESH_Y);
    const warpScene = new THREE.Scene();
    warpScene.add(place(new THREE.Mesh(warpMesh, warpMaterial), 0));

    // --- the two shapes -------------------------------------------------
    // shapecode_0: the 100-sided textured disc, red at the centre and
    // green at the rim, opaque, with a thin white outline. It is the
    // second feedback path and the colour of the whole picture.
    // shapecode_1: a four-sided pinpoint at the centre, red fading to a
    // transparent green. It is the seed that the lens pulls on.
    const overlayScene = new THREE.Scene();

    const shapeMaterial = (opts: {
      rad: number;
      ang: number;
      texAng: number;
      texZoom: number;
      color: [number, number, number, number];
      color2: [number, number, number, number];
      textured: boolean;
    }) =>
      new THREE.ShaderMaterial({
        uniforms: {
          uAspect: { value: aspect },
          uCenter: { value: new THREE.Vector2(0, 0) },
          uRad: { value: opts.rad },
          uAng: { value: opts.ang },
          uTexAng: { value: opts.texAng },
          uTexZoom: { value: opts.texZoom },
          uTex: { value: null },
          uColor: { value: new THREE.Vector4(...opts.color) },
          uColor2: { value: new THREE.Vector4(...opts.color2) },
          uTextured: { value: opts.textured ? 1 : 0 },
        },
        vertexShader: SHAPE_VERTEX,
        fragmentShader: SHAPE_FRAGMENT,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });

    const outlineMaterial = (rad: number, ang: number, alpha: number) =>
      new THREE.ShaderMaterial({
        uniforms: {
          uAspect: { value: aspect },
          uCenter: { value: new THREE.Vector2(0, 0) },
          uRad: { value: rad },
          uAng: { value: ang },
          uTexAng: { value: 0 },
          uTexZoom: { value: 1 },
          uColor: { value: new THREE.Vector4(1, 1, 1, alpha) },
        },
        vertexShader: SHAPE_VERTEX,
        fragmentShader: FLAT_FRAGMENT,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });

    const discFan = fanGeometry(100);
    const discRim = rimGeometry(100);
    const seedFan = fanGeometry(4);
    const seedRim = rimGeometry(4);

    const disc = shapeMaterial({
      rad: 0.44484,
      ang: 0,
      texAng: Math.PI,
      texZoom: 0.773457,
      color: [1, 0, 0, 1],
      color2: [0, 1, 0, 1],
      textured: true,
    });
    // `thickOutline` draws the line four times, each offset by a texel.
    // One line at the same alpha is the same mark at this size.
    const discEdge = outlineMaterial(0.44484, 0, 0.11);
    const seed = shapeMaterial({
      rad: 0.0101,
      ang: 0,
      texAng: 0,
      texZoom: 1,
      color: [1, 0, 0, 1],
      color2: [0, 1, 0, 0],
      textured: false,
    });
    const seedEdge = outlineMaterial(0.0101, 0, 0.1);

    overlayScene.add(place(new THREE.Mesh(discFan, disc), 0));
    overlayScene.add(place(new THREE.LineLoop(discRim, discEdge), 1));
    overlayScene.add(place(new THREE.Mesh(seedFan, seed), 2));
    overlayScene.add(place(new THREE.LineLoop(seedRim, seedEdge), 3));

    // --- the waveform circle -------------------------------------------
    const wavePositions = new Float32Array(WAVE_POINTS * 3);
    const waveGeometry = new THREE.BufferGeometry();
    const wavePosition = new THREE.BufferAttribute(wavePositions, 3);
    wavePosition.setUsage(THREE.DynamicDrawUsage);
    waveGeometry.setAttribute("position", wavePosition);
    const waveMaterial = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Vector4(1, 1, 1, 1) } },
      vertexShader: CLIP_VERTEX,
      fragmentShader: FLAT_FRAGMENT,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    overlayScene.add(place(new THREE.LineLoop(waveGeometry, waveMaterial), 4));

    // --- the inner border ----------------------------------------------
    const borderMesh = borderGeometry(IB_SIZE);
    const borderMaterial = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Vector4(IB0, IB0, IB0, 1) } },
      vertexShader: CLIP_VERTEX,
      fragmentShader: FLAT_FRAGMENT,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    overlayScene.add(place(new THREE.Mesh(borderMesh, borderMaterial), 5));

    // --- the present pass ------------------------------------------------
    const presentUniforms: Record<string, THREE.IUniform> = { uImage: { value: null } };
    const presentMaterial = new THREE.ShaderMaterial({
      uniforms: presentUniforms,
      vertexShader: PRESENT_VERTEX,
      fragmentShader: PRESENT_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    const presentQuad = new THREE.PlaneGeometry(2, 2);
    const presentScene = new THREE.Scene();
    presentScene.add(place(new THREE.Mesh(presentQuad, presentMaterial), 0));

    // The two buffers of the loop. Half float for the reason given on
    // `WarpVisualizer`: a decay on an 8-bit channel quantises and leaves
    // a fixed ghost. The wrap is not an option here, it is the effect.
    const floatable =
      renderer.extensions.has("EXT_color_buffer_half_float") ||
      renderer.extensions.has("EXT_color_buffer_float");
    const makeTarget = () => {
      const target = new THREE.WebGLRenderTarget(2, 2, {
        type: floatable ? THREE.HalfFloatType : THREE.UnsignedByteType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        wrapS: THREE.RepeatWrapping,
        wrapT: THREE.RepeatWrapping,
        depthBuffer: false,
        stencilBuffer: false,
      });
      return target;
    };
    let read = makeTarget();
    let write = makeTarget();

    const levels = new Float32Array(VISUALIZER_BANDS);
    const readAudio = createMilkdropAudio();
    const origin = performance.now();
    let lastFrameAt = -1;
    let frame = 0;

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(ratio);
      renderer.setSize(width, height, false);

      const scale = Math.min(1, MAX_SIDE / (Math.max(width, height) * ratio));
      const bufferW = Math.max(2, Math.round(width * ratio * scale));
      const bufferH = Math.max(2, Math.round(height * ratio * scale));
      const [ax, ay] = milkdropAspect(bufferW, bufferH);
      aspect.set(ax, ay);
      if (bufferW === read.width && bufferH === read.height) return;
      read.setSize(bufferW, bufferH);
      write.setSize(bufferW, bufferH);
    };

    /** A slow travelling wave, so the loop has something to eat in silence. */
    const idleLevels = (t: number) => {
      for (let band = 0; band < VISUALIZER_BANDS; band++) {
        const u = band / (VISUALIZER_BANDS - 1);
        levels[band] = Math.max(
          0.02,
          0.12 + 0.1 * Math.sin(t * 1.3 - u * 6.2) + 0.06 * Math.sin(t * 2.1 + u * 11.0),
        );
      }
    };

    /**
     * Wave mode 0 (`milkdropfs.cpp:3137`): a circle of radius
     * `0.5 + 0.4*sample + wave_param`, turning at `time*0.2`, with x
     * scaled by the shorter aspect. The bands arrive mirrored about the
     * halfway point, thus the loop closes with no step in it, which is
     * what MilkDrop does by blending its first tenth into its last.
     */
    const updateWave = (t: number) => {
      const half = WAVE_POINTS / 2;
      for (let j = 0; j < WAVE_POINTS; j++) {
        const i = j < half ? j : WAVE_POINTS - 1 - j;
        const at = (i / (half - 1)) * (VISUALIZER_BANDS - 1);
        const low = Math.floor(at);
        const high = Math.min(VISUALIZER_BANDS - 1, low + 1);
        const f = at - low;
        const level = levels[low] + (levels[high] - levels[low]) * (f * f * (3 - 2 * f));

        const radius = WAVE_BASE + level * WAVE_AMP;
        const ang = (j / WAVE_POINTS) * TAU + t * 0.2;
        wavePositions[j * 3] = radius * Math.cos(ang) * aspect.y;
        wavePositions[j * 3 + 1] = radius * Math.sin(ang) * aspect.x;
      }
      wavePosition.needsUpdate = true;
    };

    const present = (texture: THREE.Texture) => {
      presentUniforms.uImage.value = texture;
      renderer.setRenderTarget(null);
      renderer.clear();
      renderer.render(presentScene, camera);
    };

    const tick = (now: number) => {
      if (motion.matches || pausedRef.current) {
        // As on Warp: the image is the buffer, thus holding it still is
        // simply not warping it again. One more present, so a player
        // that opens paused shows the buffer and not an empty canvas.
        present(read.texture);
        frame = 0;
        return;
      }

      const t = (now - origin) / 1000;
      const dt = lastFrameAt < 0 ? 1 / 60 : Math.min(0.1, (now - lastFrameAt) / 1000);
      lastFrameAt = now;

      const source = spectrumRef.current;
      let energy = 0;
      if (source && source.length >= VISUALIZER_BANDS) {
        for (let band = 0; band < VISUALIZER_BANDS; band++) {
          levels[band] = source[band];
          energy += source[band];
        }
      }
      if (energy <= VISUALIZER_BANDS * SILENCE) idleLevels(t);
      const audio = readAudio(source, dt);

      // The per_frame block. Every line of it is a function of time:
      // the centre of the warp wanders, and the border and the wave
      // change colour. ob_r, ob_g and ob_b are computed by the preset
      // too, but ob_size is 0, thus there is no outer border to paint.
      const cx = CX0 - 0.4 * Math.sin(t * 0.542);
      const cy = CY0 + 0.4 * Math.sin(t * 0.753);
      const ibR = IB0 + 0.2 * Math.sin(t * 1.034);
      const ibG = IB0 + 0.2 * Math.sin(t * 1.147);
      const ibB = IB0 - 0.2 * Math.sin(t * 1.231);
      const [waveR, waveG, waveB] = maximize(
        0.5 + 0.45 * (0.5 * Math.sin(t * 0.701) + 0.3 * Math.cos(t * 0.438)),
        0.5 + 0.4 * Math.sin(t * 1.731),
        0.5 - 0.4 * (0.5 * Math.sin(t * 4.782) + 0.5 * Math.cos(t * 0.522)),
      );

      warpUniforms.uTime.value = t;
      warpUniforms.uCx.value = cx;
      warpUniforms.uCy.value = cy;
      warpUniforms.uBass.value = audio.bassAtt * BASS_ZOOM;
      // The field is written for a frame of 60 fps. A long frame must
      // move the image further and a stall must not teleport it, thus
      // the decay follows the real frame time.
      warpUniforms.uDecay.value = Math.pow(DECAY, dt * 60);
      warpUniforms.uPrev.value = read.texture;

      borderMaterial.uniforms.uColor.value.set(ibR, ibG, ibB, 1);
      waveMaterial.uniforms.uColor.value.set(waveR, waveG, waveB, 1);
      // The disc samples the frame that the warp just consumed, as the
      // engine does: it binds the previous frame and not the target.
      disc.uniforms.uTex.value = read.texture;
      updateWave(t);

      renderer.setRenderTarget(write);
      renderer.clear();
      renderer.render(warpScene, camera);
      renderer.render(overlayScene, camera);

      present(write.texture);

      const spent = read;
      read = write;
      write = spent;

      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (frame) return;
      lastFrameAt = -1;
      frame = requestAnimationFrame(tick);
    };

    startRef.current = start;
    resize();
    start();

    const observer = new ResizeObserver(() => {
      resize();
      start();
    });
    observer.observe(canvas);
    motion.addEventListener("change", start);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      motion.removeEventListener("change", start);
      startRef.current = null;
      read.dispose();
      write.dispose();
      warpMesh.dispose();
      presentQuad.dispose();
      discFan.dispose();
      discRim.dispose();
      seedFan.dispose();
      seedRim.dispose();
      waveGeometry.dispose();
      borderMesh.dispose();
      warpMaterial.dispose();
      presentMaterial.dispose();
      disc.dispose();
      discEdge.dispose();
      seed.dispose();
      seedEdge.dispose();
      waveMaterial.dispose();
      borderMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  // `tick` stops the loop at a pause, thus a resume must start it again.
  useEffect(() => {
    if (!paused) startRef.current?.();
  }, [paused]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`block h-full w-full bg-[#05040a] ${className ?? ""}`}
    />
  );
}
