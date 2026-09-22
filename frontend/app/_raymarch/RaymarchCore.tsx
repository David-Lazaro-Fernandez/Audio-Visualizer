"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { NOISE_CHUNK } from "@/app/_glsl/noise";
import { RAMP_CHUNK } from "@/app/_glsl/ramp";
import { useDrift } from "@/app/_ui/use-drift";
import {
  RAYMARCH_DRIFT_MS,
  RAYMARCH_KEYS,
  RAYMARCH_SPECS,
  raymarchDrifting,
  raymarchState,
  setRaymarchControl,
  subscribeRaymarch,
  subscribeRaymarchDrifting,
  type RaymarchState,
} from "./raymarch-controls";

/**
 * A raymarched core: the song as a lump of procedural rock.
 *
 * The first thing here with **no geometry at all**. Every other
 * visualizer draws points, lines or a mesh; this draws one fullscreen
 * quad and derives the whole image per pixel by marching a signed
 * distance function. The shape is not modelled, it is *generated* — a
 * sphere plus octaves of gradient noise, so it has detail at every scale
 * you care to look at and none of it is stored.
 *
 * The audio drives it at two spatial scales, which is as much as a
 * surface can honestly show: **bass swells** the whole body in broad slow
 * lumps, **treble roughens** it into a fine crust. Twenty-eight separate
 * bands cannot be read off a lump of rock — mapping them to spherical
 * harmonics would be mathematically faithful and visually unreadable —
 * so the spectrum is folded into two energies plus a centroid, and the
 * centroid picks the hue from the app's ramp.
 *
 * Two things about the marcher are worth knowing before changing it:
 *
 * - **It is not a true distance field.** Displacing a sphere's radius by
 *   noise breaks the Lipschitz bound a real SDF guarantees, so a full
 *   step can overshoot straight through the surface. Steps are therefore
 *   scaled down (`STEP_SCALE`), which is the standard price for being
 *   able to write the shape this simply.
 * - **Cost is per pixel, not per object.** Seventy-odd steps of
 *   multi-octave noise at 1080p is roughly 25 G noise evaluations a
 *   second, which no integrated GPU will do. So the pixel ratio is a
 *   control: the canvas keeps its CSS size and marches fewer pixels,
 *   which on an image this soft is nearly invisible.
 *
 * Keep the GLSL ASCII-only; see `app/_glsl/noise.ts`.
 */

/** Steps per ray. Fixed rather than a knob, so cost stays predictable. */
const STEPS = 72;
/** Fraction of the reported distance actually stepped; see the note above. */
const STEP_SCALE = 0.55;
/** Give up past here, in world units. */
const FAR = 24;

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
${NOISE_CHUNK}
${RAMP_CHUNK}

// Mirrored from the module constants above so the marcher reads as
// GLSL rather than as string interpolation.
const float FAR = ${FAR}.0;
const float STEP_SCALE = ${STEP_SCALE};

uniform float uTime;
uniform float uAspect;

uniform float uBass;
uniform float uTreble;
uniform float uCentroid;

uniform float uBassAmp;
uniform float uBassScale;
uniform float uTrebleAmp;
uniform float uTrebleScale;
uniform float uGlow;
uniform float uRadius;
uniform float uDistance;
uniform float uSpin;

varying vec2 vUv;

/**
 * The scene: a sphere whose radius is displaced by noise sampled on the
 * direction, so the displacement is a radial height field rather than a
 * 3D volume. That keeps it one noise lookup per octave per step, and
 * makes the surface a planet rather than a cloud.
 */
float sceneSdf(vec3 p) {
  float r = length(p);
  vec3 dir = p / max(r, 1e-4);

  float swell = fbm(dir * uBassScale + vec3(0.0, 0.0, uTime * 0.13), 3);
  float crust = fbm(dir * uTrebleScale + vec3(uTime * 0.35, 0.0, 0.0), 2);

  float surface = uRadius
    + uBassAmp * uBass * swell
    + uTrebleAmp * uTreble * crust;

  return r - surface;
}

/** Central differences. Six more field evaluations, which is the cost. */
vec3 sceneNormal(vec3 p) {
  vec2 e = vec2(0.002, 0.0);
  return normalize(vec3(
    sceneSdf(p + e.xyy) - sceneSdf(p - e.xyy),
    sceneSdf(p + e.yxy) - sceneSdf(p - e.yxy),
    sceneSdf(p + e.yyx) - sceneSdf(p - e.yyx)
  ));
}

void main() {
  // Camera orbiting the core, built by hand: there is no three.js camera
  // here because there is no geometry for one to look at.
  float angle = uTime * uSpin;
  // Never let the knobs put the eye inside the rock: a big radius and a
  // close camera is reachable by drift, and from in there every ray
  // reports a negative distance and the frame is a flat wash.
  float reach = uRadius + uBassAmp + uTrebleAmp + 0.6;
  float orbit = max(uDistance, reach);
  vec3 origin = vec3(sin(angle) * orbit, orbit * 0.22, cos(angle) * orbit);
  vec3 forward = normalize(-origin);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
  vec3 up = cross(forward, right);

  vec2 screen = (vUv - 0.5) * vec2(uAspect, 1.0);
  vec3 ray = normalize(forward + right * screen.x * 1.2 + up * screen.y * 1.2);

  float travelled = 0.0;
  float nearest = FAR;
  bool hit = false;
  vec3 point = origin;

  for (int i = 0; i < ${STEPS}; i++) {
    point = origin + ray * travelled;
    // 'distance' is a GLSL builtin, so the local is not called that.
    float dist = sceneSdf(point);
    // Track how close the ray passed even when it misses: that is the
    // silhouette glow, and the marcher already knows it.
    nearest = min(nearest, dist);
    if (dist < 0.0015 * max(1.0, travelled)) {
      hit = true;
      break;
    }
    travelled += dist * STEP_SCALE;
    if (travelled > FAR) break;
  }

  vec3 tint = ramp(uCentroid);
  vec3 colour = vec3(0.02, 0.016, 0.039);

  if (hit) {
    vec3 normal = sceneNormal(point);
    vec3 light = normalize(vec3(0.4, 0.8, 0.45));
    float diffuse = max(dot(normal, light), 0.0);
    // Rim light, so the shape reads against a dark background even where
    // nothing is lit.
    float rim = pow(1.0 - max(dot(normal, -ray), 0.0), 3.0);
    vec3 half_ = normalize(light - ray);
    float spec = pow(max(dot(normal, half_), 0.0), 48.0);

    colour += tint * (0.12 + 0.88 * diffuse);
    colour += tint * rim * 1.1;
    colour += vec3(spec) * 0.5;
  } else {
    // Bloom from the closest approach. Falls off fast, so it hugs the
    // silhouette instead of washing the frame.
    float halo = exp(-max(nearest, 0.0) * 6.0);
    colour += tint * halo * uGlow;
  }

  gl_FragColor = vec4(colour, 1.0);
}
`;

/** Bands are split into thirds; the outer two drive the shape. */
const LOW_END = 1 / 3;
const HIGH_START = 2 / 3;
/** Smoothing on the envelopes, so the rock does not judder per frame. */
const RISE = 0.35;
const FALL = 0.08;

export function RaymarchCore({
  bands,
  sample,
  paused = false,
  className = "h-full w-full",
}: {
  bands: number;
  /** Fills `out` with the current levels, 0..1 per band. Called per frame. */
  sample: (out: Float32Array) => void;
  paused?: boolean;
  className?: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const sampleRef = useRef(sample);
  sampleRef.current = sample;

  /** The walk lives with the scene, so it runs with or without a panel. */
  const [drifting, setDrifting] = useState(raymarchDrifting);
  useEffect(() => subscribeRaymarchDrifting(setDrifting), []);
  useDrift({
    enabled: drifting,
    keys: RAYMARCH_KEYS,
    specs: RAYMARCH_SPECS,
    read: raymarchState,
    write: setRaymarchControl,
    intervalMs: RAYMARCH_DRIFT_MS,
  });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    } catch {
      return; // No WebGL2.
    }
    renderer.setClearColor(0x05040a, 1);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    let config: RaymarchState = { ...raymarchState() };

    const uniforms = {
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uBass: { value: 0 },
      uTreble: { value: 0 },
      uCentroid: { value: 0.5 },
      uBassAmp: { value: config.bassAmp },
      uBassScale: { value: config.bassScale },
      uTrebleAmp: { value: config.trebleAmp },
      uTrebleScale: { value: config.trebleScale },
      uGlow: { value: config.glow },
      uRadius: { value: config.radius },
      uDistance: { value: config.distance },
      uSpin: { value: config.spin },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    const geometry = new THREE.PlaneGeometry(2, 2);
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(geometry, material));
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const resize = () => {
      const { clientWidth, clientHeight } = mount;
      if (!clientWidth || !clientHeight) return;
      // Marching costs per pixel, so the ratio *is* the quality dial. The
      // canvas keeps its CSS size and the browser scales the result up.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(dpr * config.resolution);
      renderer.setSize(clientWidth, clientHeight);
      uniforms.uAspect.value = clientWidth / clientHeight;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    const unsubscribe = subscribeRaymarch((next) => {
      const rescaled = next.resolution !== config.resolution;
      config = { ...next };
      uniforms.uBassAmp.value = config.bassAmp;
      uniforms.uBassScale.value = config.bassScale;
      uniforms.uTrebleAmp.value = config.trebleAmp;
      uniforms.uTrebleScale.value = config.trebleScale;
      uniforms.uGlow.value = config.glow;
      uniforms.uRadius.value = config.radius;
      uniforms.uDistance.value = config.distance;
      uniforms.uSpin.value = config.spin;
      if (rescaled) resize();
    });

    // --- loop ------------------------------------------------------------
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const levels = new Float32Array(bands);
    const origin = performance.now();
    /** When the clock stopped, or -1 while it is running. */
    let frozenAt = -1;
    /** Total ms spent frozen, so resuming carries on instead of jumping. */
    let frozen = 0;
    let bass = 0;
    let treble = 0;
    let centroid = 0.5;
    let frame = 0;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);

      // Freeze the clock rather than the frame, the way the water tile
      // does: the canvas keeps painting, so it does not go blank, but
      // the shape, the orbit and the spectrum all hold where they were.
      const still = motion.matches || pausedRef.current;
      if (still && frozenAt < 0) frozenAt = now;
      if (!still && frozenAt >= 0) {
        // Bank the time spent frozen. Without this the shape and the
        // orbit would jump forward by the length of the pause.
        frozen += now - frozenAt;
        frozenAt = -1;
      }
      uniforms.uTime.value = ((still ? frozenAt : now) - origin - frozen) / 1000;

      if (!still) {
        sampleRef.current(levels);

        // Fold 28 bands into what a surface can show: two energies and a
        // centroid. Rise fast, fall slow, so a hit swells the rock and it
        // subsides rather than flickering.
        let low = 0;
        let high = 0;
        let lowCount = 0;
        let highCount = 0;
        let weighted = 0;
        let total = 0;
        for (let band = 0; band < bands; band++) {
          const level = levels[band];
          const position = bands > 1 ? band / (bands - 1) : 0.5;
          if (position <= LOW_END) {
            low += level;
            lowCount++;
          } else if (position >= HIGH_START) {
            high += level;
            highCount++;
          }
          weighted += position * level;
          total += level;
        }
        const lowNow = lowCount > 0 ? low / lowCount : 0;
        const highNow = highCount > 0 ? high / highCount : 0;

        bass += (lowNow - bass) * (lowNow > bass ? RISE : FALL);
        treble += (highNow - treble) * (highNow > treble ? RISE : FALL);
        // Spectral centroid: where the energy sits, 0 bass to 1 treble.
        const centroidNow = total > 1e-4 ? weighted / total : 0.5;
        centroid += (centroidNow - centroid) * 0.06;

        uniforms.uBass.value = bass;
        uniforms.uTreble.value = treble;
        uniforms.uCentroid.value = centroid;
      }

      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
      observer.disconnect();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
    // Rebuilt only if the band count changes; the rest reaches the loop
    // through refs and the store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bands]);

  return <div ref={mountRef} className={className} />;
}
