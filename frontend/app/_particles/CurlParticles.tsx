"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CURL_NOISE_CHUNK } from "./curl-noise";
import { RAMP_CHUNK } from "@/app/_glsl/ramp";
import {
  CURL_DRIFT_MS,
  CURL_KEYS,
  CURL_SPECS,
  curlDrifting,
  curlState,
  setCurlControl,
  subscribeCurl,
  subscribeCurlDrifting,
  type CurlState,
} from "./curl-controls";
import { useDrift } from "@/app/_ui/use-drift";

/**
 * The song's particles carried by a **curl noise flow field**.
 *
 * The other sphere view computes a particle's position from its age in
 * closed form, which is cheap but rules this out: a flow field has to be
 * *integrated*, `p += v(p, t) * dt`, and the result depends on the whole
 * path taken. So this one keeps state — and keeps it on the GPU, because
 * integrating 25,600 particles on the CPU would mean 16 MB/s of position
 * uploads and 8.6M noise evaluations a second in JavaScript.
 *
 * State lives in a float texture that is ping-ponged: a fragment shader
 * reads the current positions, advances them, and writes the next ones;
 * the point cloud's vertex shader then reads positions back out of that
 * texture. One 160x160 pass a frame.
 *
 * **All of the state fits in one RGBA texture**, which is why there is no
 * second pass and no multiple-render-target plumbing:
 *
 * - `xyz` is position, which has to be integrated.
 * - `w` is *brightness*, not age. It is born equal to the band's level
 *   and decays exponentially, so one channel carries the birth loudness,
 *   the fade, and the test for death all at once. Storing age and level
 *   separately would have needed a fifth channel.
 * - Velocity is not stored at all. It is a property of the *field*, so it
 *   is a function of position and time: an outward push scaled by
 *   brightness, plus the curl. Which also means radius still reads as
 *   loudness — a bright particle is pushed hard while it is bright.
 * - Everything else is a function of the particle's index: its band is
 *   `index % bands`, its birth direction follows from that, and its
 *   lifetime from a hash.
 *
 * Respawning happens on the GPU too. A dead particle looks up its own
 * band in a small spectrum texture and comes back if that band currently
 * has energy, so the cloud's density tracks the music without the CPU
 * emitting anything.
 *
 * Shared by two surfaces: the `/particles` page, where the spectrum
 * comes from an offline transform of a decoded preview, and the blade
 * dashboard's Music Player (DESIGN.md §6.16), where it comes from a live
 * `AnalyserNode`. Neither is baked in — the caller hands over a `sample`
 * function that fills a band array, which is the only thing the field
 * needs from a song.
 *
 * Keep the GLSL ASCII-only; see `curl-noise.ts`.
 */

/** Pool is SIDE x SIDE, one texel of state per particle. */
const SIDE = 160;
const POOL = SIDE * SIDE;
/** Brightness below which a particle counts as dead. */
const DEAD = 0.02;
/** Sampling radius for the curl's central differences. */
const CURL_EPS = 0.35;
/** Largest step integrated in one frame, so a backgrounded tab cannot
 *  fling every particle to infinity when it wakes up. */
const MAX_DT = 0.05;

const FULLSCREEN_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const SIMULATE = /* glsl */ `
${CURL_NOISE_CHUNK}

uniform sampler2D uState;
uniform sampler2D uSpectrum;
uniform float uTime;
uniform float uDt;
uniform float uSide;
uniform float uBands;

uniform float uRadial;
uniform float uCurlStrength;
uniform float uCurlScale;
uniform float uFlow;
uniform float uLife;
uniform float uFloor;
uniform float uCore;
uniform float uSpread;

varying vec2 vUv;

/** Where a particle is born: latitude from its band, longitude from its index. */
vec3 birthDirection(float index, float band) {
  float u = uBands > 1.0 ? band / (uBands - 1.0) : 0.5;
  // Uniform in cos, so the sphere is covered evenly instead of bunching
  // at the poles. The jitter gives each band's ring some thickness.
  float cosTheta = clamp(-1.0 + 2.0 * u + (hash11(index * 1.7) - 0.5) * uSpread, -1.0, 1.0);
  float sinTheta = sqrt(max(0.0, 1.0 - cosTheta * cosTheta));
  // Golden angle, so successive indices fill the ring rather than
  // stacking along one meridian.
  float phi = index * 2.399963;
  return vec3(sinTheta * cos(phi), cosTheta, sinTheta * sin(phi));
}

void main() {
  vec4 state = texture2D(uState, vUv);
  vec3 p = state.xyz;
  float brightness = state.w;

  float index = floor(vUv.y * uSide) * uSide + floor(vUv.x * uSide);
  float band = mod(index, uBands);
  float level = texture2D(uSpectrum, vec2((band + 0.5) / uBands, 0.5)).r;

  // Per-particle lifetime, so shells are ragged rather than in lockstep.
  float life = uLife * (0.6 + 0.8 * hash11(index));
  brightness *= exp(-uDt / max(0.05, life));

  if (brightness < ${DEAD.toFixed(3)}) {
    if (level >= uFloor) {
      // Respawn: the band sounding now decides whether this particle
      // comes back, and how bright.
      p = birthDirection(index, band) * uCore;
      brightness = level;
    } else {
      brightness = 0.0;
    }
  } else {
    // Velocity from the field, not from stored state. The outward push
    // scales with brightness, so a loud particle travels further before
    // it fades - radius still reads as loudness.
    vec3 outward = normalize(p + vec3(1e-5));
    vec3 flow = curlNoise(p * uCurlScale + vec3(0.0, 0.0, uTime * uFlow), ${CURL_EPS.toFixed(2)});
    p += (outward * uRadial * brightness + flow * uCurlStrength) * uDt;
  }

  gl_FragColor = vec4(p, brightness);
}
`;

const DRAW_VERTEX = /* glsl */ `
attribute vec2 aUv;
attribute float aBand;     // 0 at the lowest band, 1 at the highest

uniform sampler2D uState;
uniform float uSize;
uniform float uGain;

varying vec3 vColor;
varying float vFade;

/*
 * The shared four-stop ramp ('app/_glsl/ramp.ts'), read here as a
 * **frequency** scale rather than a level one: blue is bass, red is
 * treble.
 *
 * That is a deliberate break from the other visualizers, where the same
 * stops mean loudness. Colouring by level made the field unreadable:
 * brightness decays over a particle's life, so every particle swept the
 * whole ramp as it died and the colour ended up encoding *age*,
 * identically for every band. Hue is also the only channel that
 * survives the flow - a particle carries its band wherever the curl
 * drags it, where its birth latitude is advected away within a fraction
 * of a lifetime. Loudness moves to intensity, which is what it was
 * competing with.
 */
${RAMP_CHUNK}

void main() {
  vec4 state = texture2D(uState, aUv);
  float brightness = state.w;

  if (brightness < ${DEAD.toFixed(3)}) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vColor = vec3(0.0);
    vFade = 0.0;
    return;
  }

  vec4 viewPos = modelViewMatrix * vec4(state.xyz, 1.0);
  gl_Position = projectionMatrix * viewPos;
  gl_PointSize = uSize * (0.45 + brightness) * (320.0 / max(1.0, -viewPos.z));

  // Hue from the band, intensity from the level. The gain is low because
  // the points blend additively: what you see in the dense core is the
  // *sum* of everything behind it, so a per-particle colour near 1 turns
  // the middle of the cloud into flat white and throws the hue away.
  vColor = ramp(aBand) * uGain * (0.35 + 0.9 * brightness);
  vFade = 0.3 + 0.7 * brightness;
}
`;

const DRAW_FRAGMENT = /* glsl */ `
varying vec3 vColor;
varying float vFade;

void main() {
  float d = length(gl_PointCoord - vec2(0.5));
  float alpha = (1.0 - smoothstep(0.34, 0.5, d)) * vFade;
  if (alpha <= 0.01) discard;
  gl_FragColor = vec4(vColor, alpha);
}
`;

export function CurlParticles({
  bands,
  sample,
  paused = false,
  orbit = true,
  className = "h-full w-full",
}: {
  /** How many frequency bands the spectrum has. */
  bands: number;
  /**
   * Fills `out` with the current levels, 0..1 per band. Called once a
   * frame; whatever a caller has to do to produce them — advance an
   * offline window, read a live analyser — happens in here.
   */
  sample: (out: Float32Array) => void;
  paused?: boolean;
  /**
   * Whether dragging orbits the camera. The dashboard turns it off: its
   * visualizer sits inside a 10-foot UI where a pointer-grabbing canvas
   * has no business, and drifts the view itself instead.
   */
  orbit?: boolean;
  /**
   * Classes for the mount, which **must** end up with a height: the
   * canvas is sized from this element, so a block div with none leaves
   * the renderer at its default 300x150 and the scene comes up short of
   * its container. Hence a default rather than `undefined` — the other
   * visualizers return a `<canvas>` carrying its own `h-full w-full`, so
   * omitting it here failed quietly instead of not rendering at all.
   */
  className?: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const sampleRef = useRef(sample);
  sampleRef.current = sample;

  /**
   * The drift lives with the scene, not with the panel.
   *
   * The dashboard mounts this visualizer with no overlay at all, and the
   * field still has to breathe there — so whoever is showing the field
   * runs the walk, and a panel, when there is one, is only a switch on
   * the same store flag.
   */
  const [drifting, setDrifting] = useState(curlDrifting);
  useEffect(() => subscribeCurlDrifting(setDrifting), []);
  useDrift({
    enabled: drifting,
    keys: CURL_KEYS,
    specs: CURL_SPECS,
    read: curlState,
    write: setCurlControl,
    intervalMs: CURL_DRIFT_MS,
  });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";

    // Positions need real range and precision, so full float if the driver
    // will render to it and half float otherwise. Half is enough here:
    // the cloud lives inside a few tens of units.
    const type = renderer.extensions.has("EXT_color_buffer_float")
      ? THREE.FloatType
      : THREE.HalfFloatType;

    const makeTarget = () =>
      new THREE.WebGLRenderTarget(SIDE, SIDE, {
        type,
        format: THREE.RGBAFormat,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        depthBuffer: false,
        stencilBuffer: false,
        generateMipmaps: false,
      });

    let read = makeTarget();
    let write = makeTarget();
    // Cleared to *zero*, which is brightness zero: every particle starts
    // dead and waits for its band to sound. The clear colour has to be
    // set to transparent black first — clearing with the scene's colour
    // would leave alpha at 1, so every particle would come up alive at
    // the origin and be flung out on the first frame.
    renderer.setClearColor(0x000000, 0);
    for (const target of [read, write]) {
      renderer.setRenderTarget(target);
      renderer.clear();
    }
    renderer.setRenderTarget(null);
    renderer.setClearColor(0x05040a, 1);

    // --- the spectrum, as a texture the simulation can read -------------
    const spectrumData = new Float32Array(bands);
    const spectrum = new THREE.DataTexture(
      spectrumData,
      bands,
      1,
      THREE.RedFormat,
      THREE.FloatType,
    );
    spectrum.minFilter = THREE.NearestFilter;
    spectrum.magFilter = THREE.NearestFilter;
    spectrum.needsUpdate = true;

    let config: CurlState = { ...curlState() };

    // --- simulation pass -------------------------------------------------
    const simulateUniforms = {
      uState: { value: read.texture },
      uSpectrum: { value: spectrum },
      uTime: { value: 0 },
      uDt: { value: 0 },
      uSide: { value: SIDE },
      uBands: { value: bands },
      uRadial: { value: config.radial },
      uCurlStrength: { value: config.curlStrength },
      uCurlScale: { value: config.curlScale },
      uFlow: { value: config.flow },
      uLife: { value: config.life },
      uFloor: { value: config.floor },
      uCore: { value: config.core },
      uSpread: { value: config.spread },
    };
    const simulateMaterial = new THREE.ShaderMaterial({
      uniforms: simulateUniforms,
      vertexShader: FULLSCREEN_VERTEX,
      fragmentShader: SIMULATE,
      depthTest: false,
      depthWrite: false,
    });
    const simulateGeometry = new THREE.PlaneGeometry(2, 2);
    const simulateScene = new THREE.Scene();
    simulateScene.add(new THREE.Mesh(simulateGeometry, simulateMaterial));
    const simulateCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // --- draw pass -------------------------------------------------------
    const drawUniforms = {
      uState: { value: read.texture },
      uSize: { value: config.size },
      uGain: { value: config.gain },
    };
    const drawMaterial = new THREE.ShaderMaterial({
      uniforms: drawUniforms,
      vertexShader: DRAW_VERTEX,
      fragmentShader: DRAW_FRAGMENT,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // One point per texel; `position` is unused because the vertex shader
    // reads the real one out of the state texture.
    const lookup = new Float32Array(POOL * 2);
    const bandOf = new Float32Array(POOL);
    for (let i = 0; i < POOL; i++) {
      lookup[i * 2] = ((i % SIDE) + 0.5) / SIDE;
      lookup[i * 2 + 1] = (Math.floor(i / SIDE) + 0.5) / SIDE;
      // Must agree with the simulation's own `index % uBands`: point i
      // reads texel i, because the lookup above is built in that order.
      bandOf[i] = bands > 1 ? (i % bands) / (bands - 1) : 0.5;
    }
    const drawGeometry = new THREE.BufferGeometry();
    drawGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(POOL * 3), 3),
    );
    drawGeometry.setAttribute("aUv", new THREE.BufferAttribute(lookup, 2));
    drawGeometry.setAttribute("aBand", new THREE.BufferAttribute(bandOf, 1));
    const points = new THREE.Points(drawGeometry, drawMaterial);
    points.frustumCulled = false;

    const scene = new THREE.Scene();
    scene.add(points);

    const unsubscribe = subscribeCurl((next) => {
      config = { ...next };
      simulateUniforms.uRadial.value = config.radial;
      simulateUniforms.uCurlStrength.value = config.curlStrength;
      simulateUniforms.uCurlScale.value = config.curlScale;
      simulateUniforms.uFlow.value = config.flow;
      simulateUniforms.uLife.value = config.life;
      simulateUniforms.uFloor.value = config.floor;
      simulateUniforms.uCore.value = config.core;
      simulateUniforms.uSpread.value = config.spread;
      drawUniforms.uSize.value = config.size;
      drawUniforms.uGain.value = config.gain;
    });

    // --- view ------------------------------------------------------------
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
    camera.position.set(0, 6, 34);
    let controls: OrbitControls | null = null;
    if (orbit) {
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 6;
      controls.maxDistance = 160;
      controls.update();
    }

    const resize = () => {
      const { clientWidth, clientHeight } = mount;
      // Nothing to size to yet. Bailing keeps the renderer at its own
      // default instead of collapsing to zero, and the ResizeObserver
      // calls back as soon as layout gives the mount a box.
      if (!clientWidth || !clientHeight) return;
      renderer.setSize(clientWidth, clientHeight);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    // --- loop ------------------------------------------------------------
    const origin = performance.now();
    let previous = origin;
    let frame = 0;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(MAX_DT, (now - previous) / 1000);
      previous = now;

      if (pausedRef.current) {
        // Hold the picture: no new levels, no integration, nothing to
        // upload. Still rendered, so the canvas does not go blank.
        controls?.update();
        renderer.render(scene, camera);
        return;
      }

      sampleRef.current(spectrumData);
      spectrum.needsUpdate = true;

      simulateUniforms.uTime.value = (now - origin) / 1000;
      simulateUniforms.uDt.value = dt;
      simulateUniforms.uState.value = read.texture;

      renderer.setRenderTarget(write);
      renderer.render(simulateScene, simulateCamera);
      renderer.setRenderTarget(null);

      // Swap, so the pass that just wrote becomes the one that is read.
      const swap = read;
      read = write;
      write = swap;
      drawUniforms.uState.value = read.texture;

      if (controls) {
        controls.update();
      } else {
        // No orbiting here, so the view drifts on its own: a static
        // three-quarter shot of a particle cloud reads as a still image.
        const angle = simulateUniforms.uTime.value * 0.08;
        camera.position.set(Math.sin(angle) * 34, 6, Math.cos(angle) * 34);
        camera.lookAt(0, 0, 0);
      }
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
      observer.disconnect();
      controls?.dispose();
      read.dispose();
      write.dispose();
      spectrum.dispose();
      simulateGeometry.dispose();
      simulateMaterial.dispose();
      drawGeometry.dispose();
      drawMaterial.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
    // Rebuilt only if the band count or the orbit mode changes; the
    // spectrum source reaches the loop through a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bands, orbit]);

  return <div ref={mountRef} className={className} />;
}
