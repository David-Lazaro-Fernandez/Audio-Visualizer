"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { NOISE_CHUNK } from "@/app/_glsl/noise";
import { RAMP_CHUNK } from "@/app/_glsl/ramp";
import { beatClock } from "./beat-clock";
import { VISUALIZER_BANDS } from "./visualizer-styles";

/**
 * Warp (DESIGN.md §6.16): the one visualizer that draws almost nothing.
 *
 * Every other style builds its picture again at each frame out of the
 * band array of that moment. This one keeps a buffer, and at each frame
 * it does two things to it: it moves the whole image through a
 * displacement field and dims it a little, then it draws one curve of
 * the spectrum over the result. The picture on the screen is therefore
 * the last two seconds of the music, each frame of it pushed a little
 * further along the field by the frames that came after it. Nothing
 * models the tunnels and the flowers that come out; they are the path
 * that the field traces, made visible because the image is slow to
 * fade.
 *
 * This is the method of the Geiss screensaver (Ryan Geiss, 1998, BSD
 * 3-Clause, `github.com/geissomatik/geiss`), and it is here because the
 * eight styles before it had no feedback at all. It is also by a long
 * way the cheapest of the nine: one texture read for each pixel, where
 * the raymarched core spends seventy steps of multi-octave noise. Depth
 * that is bought over time and not over instructions.
 *
 * Three of its decisions are worth keeping straight:
 *
 * - **The displacement is read, not computed.** Geiss could not afford
 *   a coordinate for each pixel for each frame, thus it precomputed a
 *   "warp map" of six bytes for each pixel: two for the address of the
 *   source and four for the weights of the bilinear blend of the 2x2
 *   around it. That map is exactly what a `texture2D` of a `LINEAR`
 *   sampler does in one instruction, thus the shader here computes the
 *   coordinate and lets the hardware do the part that was expensive.
 *
 * - **The buffer is half float.** Geiss kept the low eight bits that
 *   its fixed-point divide discarded and carried them into the next
 *   pixel, which dithered the image for free. The problem that solved
 *   is real and is the reason this target is not `UnsignedByteType`: a
 *   decay of 0.95 on an 8-bit channel quantises, thus dim trails stop
 *   at a value that cannot fall further and leave a fixed ghost. More
 *   bits is the modern form of the same fix.
 *
 * - **The beat changes the field, it does not shake it.** Geiss built
 *   its next map in the background, a row at a time, and switched to it
 *   at the next beat. Thus the motion of the image changed on a beat
 *   and then stayed changed until the next map was ready. That is a
 *   different use of a beat from the swell of `blade-pulse.ts`, and it
 *   is the use that needs a phase and not an onset: `beat-clock.ts`
 *   says where the beat is, and the field is swapped there. The time
 *   that Geiss needed to build a map becomes `MIN_SWAP_S` here, because
 *   a field is a handful of uniforms and costs nothing to make: the
 *   wait is what the eye wants, not what the CPU needs.
 *
 * With no beat to be found (`locked` false: speech, ambient, a fade)
 * the swap falls back to a timer, which is what the crude broadband
 * detector of the original effectively did.
 *
 * ## What a swap draws
 *
 * Geiss did not sort one thing at a swap, it sorted two: a **mode**,
 * which is how the image moves, and a **waveform**, which is the shape
 * that feeds the loop. That is where its variety came from, and it is
 * cheap: the same ring inside a perspective field reads as a tunnel of
 * rings and inside a spherical one as a ball, so two catalogues of a
 * handful of entries each cover more ground than one catalogue of
 * twenty. Both are sorted here (`drawField`, `WarpWave`).
 *
 * Its eleven modes are all the same two numbers — a radial scale and a
 * turn — made a function of where the pixel is, and the four
 * `WarpCharacter` values are the four shapes that function can take:
 * flat (a spiral), a function of `sqrt(r)` (rings), a function of the
 * angle (petals) and noise (fuzzy). One at a time, because that is what
 * a mode is; two together average into mush.
 */

/** The width of the buffer, at most. A feedback image is soft, thus this does not show. */
const MAX_SIDE = 900;

/** The points along one half of the curve. 28 bands are interpolated across them. */
const CURVE_POINTS = 192;
/** How far across the frame the line wave runs, and how tall a full band is, in clip units. */
const CURVE_WIDTH = 0.92;
const CURVE_HEIGHT = 0.5;
/** The radius of the ring wave with no signal, and how far a full band pushes it out. */
const RING_RADIUS = 0.3;
const RING_AMP = 0.38;

/** Seconds that a field is kept before the code starts to look for a beat to change it on. */
const MIN_SWAP_S = 3.5;
/** With no beat to wait for, the field changes this much later than that. */
const NO_BEAT_GRACE_S = 1.5;

/** How much the bass opens the zoom of the field, over its own value. */
const BASS_ZOOM = 0.012;
/** The bands under this index count as bass here. It follows `use-blade-pulse.ts`. */
const BASS_BANDS = 8;
/** Below this mean level the input counts as silence and the idle curve takes over. */
const SILENCE = 0.01;

/**
 * How much brighter the curve is drawn at the beat.
 *
 * This is the one part of the picture that follows the phase and not
 * the field, and it is deliberate: a swap of the field is rare, thus
 * without this there would be nothing on the screen to show that the
 * clock is right. It is small, because a visualizer that flashes at
 * each beat is a strobe.
 */
const BEAT_ACCENT = 0.55;

/**
 * What a field does beyond turning and zooming.
 *
 * Geiss shipped eleven *modes*, and the reading of its map generator
 * that matters is that all eleven are the same two numbers — a radial
 * scale and a turn — made a function of the position of the pixel. Its
 * sphere is a scale that grows with the radius; its tunnel is one that
 * falls with it; its ripples are `sin(sqrt(r))`; its flower petals are
 * a scale that follows the angle. Those are the four here, and one is
 * chosen at a time, because a mode is a character and two of them at
 * once average into mush.
 */
type WarpCharacter = "plain" | "ripple" | "petals" | "fuzzy";

/**
 * Which shape is drawn into the buffer, sorted with the field.
 *
 * Geiss sorted its waveform separately from its mode, and that is where
 * most of its variety came from: the same ring inside a perspective
 * reads as a tunnel of rings, and inside a spherical warp as a ball.
 * With one shape only, a swap changes how the image moves but never
 * what is moving.
 */
type WarpWave = "line" | "ring";

/**
 * A field is these numbers. They are per-frame amounts at 60 fps; the
 * loop scales them by the real frame time.
 *
 * The ranges are the whole design of the effect, and they are
 * conservative on purpose. A feedback loop compounds: a zoom of 1.01 at
 * each frame is 1.8 times a second and 60 times over a swap, thus a
 * value that looks small is already fast on the screen. Geiss had the
 * same problem and the same answer, a `protective_factor` that pulled
 * every scale back toward 1.
 */
interface WarpField {
  /** Radial scale. Away from 1 the image flies out or falls in. */
  zoom: number;
  /** Rotation of the whole frame, in radians. */
  rotate: number;
  /** Extra rotation near the centre, which twists the image instead of turning it. */
  swirl: number;
  /** The zoom in rings of alternating sign, and how many rings. Geiss mode 8. */
  ripple: number;
  rippleK: number;
  /** The zoom as a function of the angle, and how many lobes. Geiss mode 9. */
  petals: number;
  petalAmount: number;
  /** Displacement by gradient noise, and the size of its cells. Geiss mode 7. */
  noise: number;
  noiseScale: number;
  /** What is left of a pixel after one frame. It sets the length of the trail. */
  decay: number;
  wave: WarpWave;
}

const between = (low: number, high: number) => low + Math.random() * (high - low);
/** Away from zero: a field with no motion at all leaves the image to sit and fade. */
const signed = (low: number, high: number) =>
  (Math.random() < 0.5 ? -1 : 1) * between(low, high);

const CHARACTERS: WarpCharacter[] = ["plain", "ripple", "petals", "fuzzy"];

function drawField(): WarpField {
  const character = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
  return {
    zoom: signed(0.004, 0.016),
    rotate: signed(0.001, 0.011),
    swirl: signed(0.002, 0.026),
    ripple: character === "ripple" ? signed(0.002, 0.006) : 0,
    // `sqrt(r)` over a half-frame of 0.7 runs to 0.84, thus this is
    // near one ring for each 7 units: six to twenty rings across the
    // frame.
    rippleK: between(6, 26),
    // A whole number of lobes, and nothing else. `sin(angle * n)` is
    // continuous around the frame only when n is an integer; at 4.5 the
    // field tears along the negative x axis, where `atan` wraps.
    petals: Math.round(between(3, 9)),
    petalAmount: character === "petals" ? between(0.002, 0.009) : 0,
    noise: character === "fuzzy" ? between(0.0004, 0.0016) : 0,
    noiseScale: between(1.2, 4),
    decay: between(0.93, 0.975),
    wave: Math.random() < 0.5 ? "line" : "ring",
  };
}

const WARP_FRAGMENT = /* glsl */ `
${NOISE_CHUNK}

uniform sampler2D uPrev;
uniform vec2  uAspect;
uniform float uTime;
uniform float uDecay;
uniform float uZoom;
uniform float uRotate;
uniform float uSwirl;
uniform float uRipple;
uniform float uRippleK;
uniform float uPetals;
uniform float uPetalAmount;
uniform float uNoise;
uniform float uNoiseScale;

varying vec2 vUv;

void main() {
  // Square coordinates about the centre, thus the field stays circular
  // on a tile that is not square.
  vec2 p = (vUv - 0.5) * uAspect;
  float r = length(p);

  // The swirl falls off outward, thus the image twists about its centre
  // and does not turn as one disc.
  float angle = uRotate + uSwirl * exp(-r * 2.4);
  float c = cos(angle);
  float s = sin(angle);

  // The scale is where a mode lives. Flat it is a spiral; as a function
  // of sqrt(r) it is rings that pull in and push out by turns; as a
  // function of the angle it is petals.
  float scale = uZoom;
  if (uRipple != 0.0) scale += uRipple * sin(sqrt(r) * uRippleK);
  if (uPetalAmount != 0.0) scale *= 1.0 + uPetalAmount * sin(atan(p.y, p.x) * uPetals);

  vec2 q = mat2(c, -s, s, c) * p * scale;

  if (uNoise > 0.0) {
    vec3 n = vec3(p * uNoiseScale, uTime * 0.05);
    q += uNoise * vec2(gnoise(n), gnoise(n + vec3(19.7, 7.3, 3.1)));
  }

  vec2 uv = q / uAspect + 0.5;

  // Outside the frame there is no history to pull in. A clamped sample
  // would smear the border pixels inward as long streaks, thus the
  // sample fades to black over the last two percent instead.
  vec2 edge = smoothstep(vec2(0.0), vec2(0.02), uv) *
              (1.0 - smoothstep(vec2(0.98), vec2(1.0), uv));

  vec3 prev = texture2D(uPrev, clamp(uv, 0.0, 1.0)).rgb;
  gl_FragColor = vec4(prev * uDecay * edge.x * edge.y, 1.0);
}
`;

const CURVE_VERTEX = /* glsl */ `
attribute float aLevel;
varying float vLevel;

void main() {
  vLevel = aLevel;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const CURVE_FRAGMENT = /* glsl */ `
${RAMP_CHUNK}

uniform float uIntensity;
varying float vLevel;

void main() {
  // The ramp reads level here, as it does on the LED matrix, thus a
  // loud band burns red into the buffer and a quiet one leaves a blue
  // trace.
  float level = clamp(vLevel, 0.0, 1.0);
  gl_FragColor = vec4(ramp(level) * (0.25 + 0.9 * level) * uIntensity, 1.0);
}
`;

const PRESENT_FRAGMENT = /* glsl */ `
uniform sampler2D uImage;
varying vec2 vUv;

void main() {
  vec3 c = texture2D(uImage, vUv).rgb;
  // A feedback loop adds to itself and goes far past 1 where the curve
  // crosses its own trail. The shoulder keeps those places coloured
  // instead of clipping them to white.
  gl_FragColor = vec4(vec3(1.0) - exp(-c * 1.25), 1.0);
}
`;

const QUAD_VERTEX = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export function WarpVisualizer({
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
    renderer.setClearColor(0x07060c, 1);
    renderer.autoClear = false;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

    // One camera and one quad serve the warp pass and the present pass.
    // The vertex shader writes clip space directly, thus the camera only
    // has to exist.
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.PlaneGeometry(2, 2);

    const warpUniforms: Record<string, THREE.IUniform> = {
      uPrev: { value: null },
      uAspect: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uDecay: { value: 0.95 },
      uZoom: { value: 1 },
      uRotate: { value: 0 },
      uSwirl: { value: 0 },
      uRipple: { value: 0 },
      uRippleK: { value: 12 },
      uPetals: { value: 5 },
      uPetalAmount: { value: 0 },
      uNoise: { value: 0 },
      uNoiseScale: { value: 2 },
    };
    const warpMaterial = new THREE.ShaderMaterial({
      uniforms: warpUniforms,
      vertexShader: QUAD_VERTEX,
      fragmentShader: WARP_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    const warpScene = new THREE.Scene();
    warpScene.add(new THREE.Mesh(quad, warpMaterial));

    const presentUniforms: Record<string, THREE.IUniform> = { uImage: { value: null } };
    const presentMaterial = new THREE.ShaderMaterial({
      uniforms: presentUniforms,
      vertexShader: QUAD_VERTEX,
      fragmentShader: PRESENT_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    const presentScene = new THREE.Scene();
    presentScene.add(new THREE.Mesh(quad, presentMaterial));

    // The curve is one closed line of 2N points that runs out over the
    // spectrum and back over it mirrored. Both waves use that one
    // buffer: the line puts the two halves above and below the middle,
    // the ring puts them around a circle. Because the two halves read
    // the same band, the shape is symmetric and the loop closes with no
    // seam — which is the problem Geiss solved by blending the first
    // fifty samples of its circular wave into the last fifty.
    const curvePositions = new Float32Array(CURVE_POINTS * 2 * 3);
    const curveLevels = new Float32Array(CURVE_POINTS * 2);
    const curveGeometry = new THREE.BufferGeometry();
    // Both attributes are rewritten at each frame, thus the driver is
    // told not to keep them in slow memory.
    const positionAttribute = new THREE.BufferAttribute(curvePositions, 3);
    const levelAttribute = new THREE.BufferAttribute(curveLevels, 1);
    positionAttribute.setUsage(THREE.DynamicDrawUsage);
    levelAttribute.setUsage(THREE.DynamicDrawUsage);
    curveGeometry.setAttribute("position", positionAttribute);
    curveGeometry.setAttribute("aLevel", levelAttribute);
    const curveUniforms: Record<string, THREE.IUniform> = { uIntensity: { value: 1 } };
    // `transparent` is what turns blending on at all in three; the
    // additive mode alone does nothing on an opaque material.
    const curveMaterial = new THREE.ShaderMaterial({
      uniforms: curveUniforms,
      vertexShader: CURVE_VERTEX,
      fragmentShader: CURVE_FRAGMENT,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
    const curve = new THREE.LineLoop(curveGeometry, curveMaterial);
    const curveScene = new THREE.Scene();
    curveScene.add(curve);

    // The two buffers of the feedback loop. Half float and not bytes:
    // refer to the head of this file. A context that cannot render to
    // half float takes bytes and the banded trail with them, which is
    // the old picture and not a broken one.
    const floatable =
      renderer.extensions.has("EXT_color_buffer_half_float") ||
      renderer.extensions.has("EXT_color_buffer_float");
    const makeTarget = (width: number, height: number) =>
      new THREE.WebGLRenderTarget(width, height, {
        type: floatable ? THREE.HalfFloatType : THREE.UnsignedByteType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
        stencilBuffer: false,
      });
    let read = makeTarget(2, 2);
    let write = makeTarget(2, 2);

    const levels = new Float32Array(VISUALIZER_BANDS);
    // A circle in clip space is an ellipse on a tile that is not
    // square. The field has `uAspect` for this; the curve is geometry,
    // thus it carries its own.
    let ringX = 1;
    let ringY = 1;
    let field = drawField();
    const origin = performance.now();
    let swappedAt = 0;
    let lastBeat = -1;
    let lastFrameAt = -1;
    let frame = 0;

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(ratio);
      // updateStyle is off: the classes of the canvas give its size.
      renderer.setSize(width, height, false);

      const scale = Math.min(1, MAX_SIDE / (Math.max(width, height) * ratio));
      const bufferW = Math.max(2, Math.round(width * ratio * scale));
      const bufferH = Math.max(2, Math.round(height * ratio * scale));
      if (bufferW === read.width && bufferH === read.height) return;
      // A resize starts the loop again from black. There is no way to
      // carry an accumulation across a change of resolution that is
      // worth the code.
      read.setSize(bufferW, bufferH);
      write.setSize(bufferW, bufferH);
      warpUniforms.uAspect.value.set(
        Math.max(1, bufferW / bufferH),
        Math.max(1, bufferH / bufferW),
      );
      ringX = Math.min(1, bufferH / bufferW);
      ringY = Math.min(1, bufferW / bufferH);
    };

    /** A slow travelling wave, so that the loop has something to eat in silence. */
    const idleLevels = (t: number) => {
      for (let band = 0; band < VISUALIZER_BANDS; band++) {
        const u = band / (VISUALIZER_BANDS - 1);
        levels[band] = Math.max(
          0.02,
          0.12 + 0.1 * Math.sin(t * 1.3 - u * 6.2) + 0.06 * Math.sin(t * 2.1 + u * 11.0),
        );
      }
    };

    /** Interpolates the bands across the points of the curve and writes the geometry. */
    const updateCurve = (wave: WarpWave) => {
      const total = CURVE_POINTS * 2;
      for (let j = 0; j < total; j++) {
        // The second half walks the bands backward, thus the two halves
        // are mirror images and the closed loop has no step in it.
        const i = j < CURVE_POINTS ? j : total - 1 - j;
        const u = i / (CURVE_POINTS - 1);
        const at = u * (VISUALIZER_BANDS - 1);
        const low = Math.floor(at);
        const high = Math.min(VISUALIZER_BANDS - 1, low + 1);
        const f = at - low;
        // Smoothstep and not a straight mix: 28 bands across 192 points
        // are visibly faceted with a linear blend, and the corners
        // survive the warp as creases.
        const level = levels[low] + (levels[high] - levels[low]) * (f * f * (3 - 2 * f));

        if (wave === "ring") {
          // Bass at the right of the circle, treble at the left, and
          // symmetric about the horizontal. A ring inside a perspective
          // field is what reads as a tunnel.
          const theta = (j / total) * Math.PI * 2;
          const radius = RING_RADIUS + level * RING_AMP;
          curvePositions[j * 3] = Math.cos(theta) * radius * ringX;
          curvePositions[j * 3 + 1] = Math.sin(theta) * radius * ringY;
        } else {
          curvePositions[j * 3] = (u - 0.5) * 2 * CURVE_WIDTH;
          curvePositions[j * 3 + 1] =
            (j < CURVE_POINTS ? level : -level) * CURVE_HEIGHT;
        }
        curveLevels[j] = level;
      }
      positionAttribute.needsUpdate = true;
      levelAttribute.needsUpdate = true;
    };

    const tick = (now: number) => {
      // There is no frozen clock to keep here, unlike the other WebGL
      // styles: the image is the buffer, thus holding it still is
      // simply not warping it again.
      if (motion.matches || pausedRef.current) {
        // The loop stops and the image holds. Under reduced motion an
        // image that moves by itself is what the preference asks not to
        // see, and a feedback buffer held still is simply a picture.
        // The present pass runs one more time, thus a player that opens
        // paused shows the buffer instead of an empty canvas.
        presentUniforms.uImage.value = read.texture;
        renderer.setRenderTarget(null);
        renderer.clear();
        renderer.render(presentScene, camera);
        frame = 0;
        return;
      }

      const t = (now - origin) / 1000;
      // The field is written as an amount for each frame at 60 fps. A
      // long frame must move the image further, and a stall must not
      // teleport it.
      const steps = lastFrameAt < 0 ? 1 : Math.min(3, ((now - lastFrameAt) / 1000) * 60);
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

      let bass = 0;
      for (let band = 0; band < BASS_BANDS; band++) bass = Math.max(bass, levels[band]);

      // The beat decides when the field changes, and the phase lights
      // the curve between those changes.
      const clock = beatClock(now);
      const ready = t - swappedAt >= MIN_SWAP_S;
      if (ready && clock.locked && clock.beat !== lastBeat) {
        field = drawField();
        swappedAt = t;
      } else if (!clock.locked && t - swappedAt >= MIN_SWAP_S + NO_BEAT_GRACE_S) {
        field = drawField();
        swappedAt = t;
      }
      lastBeat = clock.beat;

      const accent = clock.locked
        ? 1 + BEAT_ACCENT * clock.confidence * Math.pow(1 - clock.phase, 3)
        : 1;

      // The bass opens the zoom over whatever the field asks for, thus
      // the image still answers the music between two swaps.
      const zoom = field.zoom + Math.sign(field.zoom) * bass * BASS_ZOOM;
      warpUniforms.uTime.value = t;
      warpUniforms.uZoom.value = 1 + zoom * steps;
      warpUniforms.uRotate.value = field.rotate * steps;
      warpUniforms.uSwirl.value = field.swirl * steps;
      warpUniforms.uRipple.value = field.ripple * steps;
      warpUniforms.uRippleK.value = field.rippleK;
      warpUniforms.uPetals.value = field.petals;
      warpUniforms.uPetalAmount.value = field.petalAmount * steps;
      warpUniforms.uNoise.value = field.noise * steps;
      warpUniforms.uNoiseScale.value = field.noiseScale;
      warpUniforms.uDecay.value = Math.pow(field.decay, steps);
      curveUniforms.uIntensity.value = accent;

      updateCurve(field.wave);

      // Warp what was there into the other buffer, draw this frame's
      // curve over it, then show the result. The buffers change places,
      // thus what is shown is what the next frame warps.
      warpUniforms.uPrev.value = read.texture;
      renderer.setRenderTarget(write);
      renderer.clear();
      renderer.render(warpScene, camera);
      renderer.render(curveScene, camera);

      presentUniforms.uImage.value = write.texture;
      renderer.setRenderTarget(null);
      renderer.clear();
      renderer.render(presentScene, camera);

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
      curveGeometry.dispose();
      quad.dispose();
      curveMaterial.dispose();
      warpMaterial.dispose();
      presentMaterial.dispose();
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
      className={`block h-full w-full bg-[#07060c] ${className ?? ""}`}
    />
  );
}
