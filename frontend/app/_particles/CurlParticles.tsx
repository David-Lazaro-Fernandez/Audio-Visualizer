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
 * The particles of the song, carried by a curl noise flow field.
 *
 * The other sphere view computes the position of a particle from its age
 * in closed form. That is cheap, but it is not possible here: a flow
 * field must be integrated, `p += v(p, t) * dt`, and the result depends
 * on the full path. Thus this view keeps state, and it keeps the state on
 * the GPU. To integrate 25,600 particles on the CPU would need 16 MB/s of
 * position uploads and 8.6M noise evaluations a second in JavaScript.
 *
 * The state is in a float texture that is ping-ponged. A fragment shader
 * reads the current positions, advances them and writes the next
 * positions. The vertex shader of the point cloud then reads the
 * positions from that texture. This is one 160x160 pass a frame.
 *
 * All the state fits in one RGBA texture. Thus there is no second pass
 * and no multiple-render-target plumbing:
 *
 * - `xyz` is the position, which must be integrated.
 * - `w` is the brightness, not the age. It starts at the level of the
 *   band and decays exponentially, thus one channel holds the loudness at
 *   birth, the fade and the test for death. Age and level in separate
 *   channels would have needed a fifth channel.
 * - The velocity is not stored. It is a property of the field, thus it is
 *   a function of the position and the time: an outward push scaled by
 *   the brightness, plus the curl. Thus the radius also shows the
 *   loudness, because a bright particle gets a strong push while it is
 *   bright.
 * - The other values are functions of the index of the particle. Its band
 *   is `index % bands`, its birth direction comes from the band, and its
 *   lifetime comes from a hash.
 *
 * The respawn also occurs on the GPU. A dead particle reads its own band
 * in a small spectrum texture and comes back if that band has energy now.
 * Thus the density of the cloud follows the music and the CPU emits
 * nothing.
 *
 * Two surfaces use this component. On the `/particles` page the spectrum
 * comes from an offline transform of a decoded preview. In the Music
 * Player of the blade dashboard (DESIGN.md §6.16) it comes from a live
 * `AnalyserNode`. Neither source is built in: the caller gives a `sample`
 * function that fills a band array, which is all that the field needs
 * from a song.
 *
 * Use only ASCII characters in the GLSL. Refer to `curl-noise.ts`.
 */

/** Pool is SIDE x SIDE, one texel of state per particle. */
const SIDE = 160;
const POOL = SIDE * SIDE;
/** Brightness below which a particle counts as dead. */
const DEAD = 0.02;
/** Sampling radius for the curl's central differences. */
const CURL_EPS = 0.35;
/** Largest step integrated in one frame. It prevents a backgrounded tab
 *  from throwing each particle to infinity when it becomes active. */
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
  // Uniform in cos, thus the particles cover the sphere equally and do
  // not collect at the poles. The jitter gives each ring a thickness.
  float cosTheta = clamp(-1.0 + 2.0 * u + (hash11(index * 1.7) - 0.5) * uSpread, -1.0, 1.0);
  float sinTheta = sqrt(max(0.0, 1.0 - cosTheta * cosTheta));
  // Golden angle, thus subsequent indices fill the ring and do not stack
  // on one meridian.
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

  // A different lifetime for each particle, thus the shells are ragged
  // and do not move together.
  float life = uLife * (0.6 + 0.8 * hash11(index));
  brightness *= exp(-uDt / max(0.05, life));

  if (brightness < ${DEAD.toFixed(3)}) {
    if (level >= uFloor) {
      // Respawn: the band that sounds now decides if this particle comes
      // back, and how bright it is.
      p = birthDirection(index, band) * uCore;
      brightness = level;
    } else {
      brightness = 0.0;
    }
  } else {
    // The velocity comes from the field, not from stored state. The
    // outward push scales with the brightness, thus a loud particle moves
    // further before it fades and the radius shows the loudness.
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
 * The shared four-stop ramp ('app/_glsl/ramp.ts'). Here it is a
 * frequency scale and not a level scale: blue is bass, red is treble.
 *
 * This is different from the other visualizers, where the same stops
 * show loudness. Colour by level made the field unreadable. The
 * brightness decays during the life of a particle, thus each particle
 * moved through the full ramp as it died and the colour showed only the
 * age, equally for each band. Hue is also the only channel that stays
 * correct in the flow: a particle keeps its band wherever the curl moves
 * it, but its birth latitude is advected away in a fraction of a
 * lifetime. Loudness moves to the intensity, which is the channel it
 * competed with.
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
  // the points blend additively: the dense core shows the sum of all the
  // points behind it. Thus a per-particle colour near 1 makes the middle
  // of the cloud flat white and removes the hue.
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
   * Fills `out` with the current levels, 0..1 for each band. The
   * component calls it one time a frame. The caller does the necessary
   * work in the function: advance an offline window, or read a live
   * analyser.
   */
  sample: (out: Float32Array) => void;
  paused?: boolean;
  /**
   * Whether a drag orbits the camera. The dashboard sets it to false: its
   * visualizer is in a 10-foot UI, where a canvas must not take the
   * pointer. The dashboard drifts the view instead.
   */
  orbit?: boolean;
  /**
   * Classes for the mount. They must give the element a height, because
   * the canvas takes its size from this element. A block div with no
   * height leaves the renderer at its default 300x150, and the scene is
   * smaller than its container. Thus there is a default value and not
   * `undefined`. The other visualizers return a `<canvas>` that has its
   * own `h-full w-full`, thus an omitted class name here gave a small
   * scene and no error.
   */
  className?: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const sampleRef = useRef(sample);
  sampleRef.current = sample;

  /**
   * The drift runs with the scene, not with the panel.
   *
   * The dashboard mounts this visualizer with no overlay, and the field
   * must still breathe there. Thus the component that shows the field
   * runs the walk, and a panel, when there is one, is only a switch on
   * the same flag in the store.
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

    // Positions need range and precision. Use full float if the driver
    // can render to it, else half float. Half float is sufficient here,
    // because the cloud stays in a few tens of units.
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
    // Clear to zero, which is brightness zero: each particle starts dead
    // and waits for its band to sound. Set the clear colour to
    // transparent black first. A clear with the colour of the scene
    // leaves alpha at 1, thus each particle would start alive at the
    // origin and move out on the first frame.
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

    // One point for each texel. `position` is not used, because the
    // vertex shader reads the true position from the state texture.
    const lookup = new Float32Array(POOL * 2);
    const bandOf = new Float32Array(POOL);
    for (let i = 0; i < POOL; i++) {
      lookup[i * 2] = ((i % SIDE) + 0.5) / SIDE;
      lookup[i * 2 + 1] = (Math.floor(i / SIDE) + 0.5) / SIDE;
      // This must agree with `index % uBands` in the simulation. Point i
      // reads texel i, because the lookup above is in that order.
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
      // There is no size yet. A return keeps the renderer at its own
      // default and prevents a collapse to zero. The ResizeObserver calls
      // again when the layout gives the mount a box.
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
        // Hold the picture: no new levels, no integration and no upload.
        // The component still renders, thus the canvas does not go blank.
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

      // Swap, thus the pass that wrote becomes the pass that is read.
      const swap = read;
      read = write;
      write = swap;
      drawUniforms.uState.value = read.texture;

      if (controls) {
        controls.update();
      } else {
        // There is no orbit here, thus the view drifts on its own. A
        // static three-quarter view of a cloud looks like a still image.
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
    // Rebuilt only when the band count or the orbit mode changes. The
    // spectrum source reaches the loop through a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bands, orbit]);

  return <div ref={mountRef} className={className} />;
}
