"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { SlidingSpectrogram } from "./song-spectrogram";
import {
  sphereState,
  subscribeSphere,
  type SphereState,
} from "./sphere-controls";

/**
 * The song as particles thrown off a sphere.
 *
 * Where the grid view lays the spectrogram out as a landscape, this one
 * *emits* it. Every slice of the transform fires a particle for each band
 * that had energy, and the particle is born on a small sphere, travels
 * outward along its own direction, and dies. So the frequency content
 * becomes a shell of shells rather than a surface.
 *
 * The mapping is what makes it readable:
 *
 * - **Direction is frequency.** Latitude comes from the band — bass at
 *   the south pole, treble at the north — so a band always leaves in the
 *   same ring. Longitude advances by the golden angle on every emission,
 *   which fills each ring evenly instead of stacking particles along one
 *   meridian.
 * - **Speed is level.** A loud band throws its particle hard and it gets
 *   far out; a quiet one barely leaves the core. Radius therefore reads
 *   as loudness, the way height did in the grid.
 * - **Life is time.** A particle fades over a fixed lifetime, so the
 *   distance of a shell from the centre is also how long ago it sounded.
 *
 * **The simulation is stateless on the GPU.** A particle's attributes —
 * birth, direction, speed, lifetime, level — are written once when it is
 * emitted, and the vertex shader derives its position from
 * `uTime - aBirth`. Nothing is integrated on the CPU and nothing is
 * rewritten per frame, which is the only way this is affordable:
 * re-uploading a 24,000-particle pool every frame would be 38 MB/s of
 * bus traffic to move points that follow a closed-form path anyway.
 * Emission writes a contiguous run of the ring, so only that run is
 * uploaded (`addUpdateRange`).
 *
 * Keep the GLSL ASCII-only: WebGL rejects source containing characters
 * outside the GLSL ES set, comments included, and reports it before the
 * compiler runs.
 */

/**
 * Particles in the pool. About 11,000 are alive at a time with these
 * settings, so this leaves a little over twofold headroom for a dense
 * passage.
 */
const POOL = 24000;
/**
 * Radius, lifetime, speed, drag, swirl and the emission floor are all
 * live-adjustable from `sphere-controls.ts` — the shape of this thing is
 * the point of the page, so it is not worth burying in constants.
 */

/** Jitter on a particle's lifetime, as a fraction, so shells are ragged. */
const LIFE_JITTER = 0.25;
/** Golden angle, for filling each latitude ring evenly over time. */
const GOLDEN_ANGLE = 2.399963;

const VERTEX = /* glsl */ `
attribute float aBirth;
attribute float aSpeed;
attribute float aLife;
attribute float aLevel;

uniform float uTime;
uniform float uSize;
uniform float uCore;
uniform float uDrag;
uniform float uSwirl;

varying vec3 vColor;
varying float vFade;

/** The level scale shared with the dashboard's visualizers. */
vec3 ramp(float t) {
  vec3 blue   = vec3(0.298, 0.780, 1.000);
  vec3 violet = vec3(0.706, 0.361, 1.000);
  vec3 amber  = vec3(1.000, 0.541, 0.239);
  vec3 red    = vec3(1.000, 0.231, 0.188);
  if (t < 0.40) return mix(blue, violet, t / 0.40);
  if (t < 0.72) return mix(violet, amber, (t - 0.40) / 0.32);
  return mix(amber, red, clamp((t - 0.72) / 0.28, 0.0, 1.0));
}

void main() {
  float age = uTime - aBirth;
  // Unborn or already dead: collapse it rather than branch around the
  // rest, so every invocation still writes gl_Position.
  if (age < 0.0 || age > aLife) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vColor = vec3(0.0);
    vFade = 0.0;
    return;
  }

  // Exponential drag: quick away from the core, then settling. The cloud
  // gets an outer edge instead of expanding without limit.
  float reach = aSpeed * uDrag * (1.0 - exp(-age / uDrag));

  // A slow twist about the polar axis, so the shells shear past each
  // other and the sphere does not read as a frozen diagram.
  float spin = uSwirl * age;
  float c = cos(spin);
  float s = sin(spin);
  vec3 dir = vec3(
    position.x * c - position.z * s,
    position.y,
    position.x * s + position.z * c
  );

  vec4 viewPos = modelViewMatrix * vec4(dir * (uCore + reach), 1.0);
  gl_Position = projectionMatrix * viewPos;

  float t = age / aLife;
  gl_PointSize =
    uSize * (0.45 + aLevel) * (1.0 - 0.45 * t) * (320.0 / max(1.0, -viewPos.z));

  // Newest particles are brightest, so the leading shell is "now".
  vColor = ramp(aLevel) * (0.55 + 0.75 * (1.0 - t));
  vFade = (1.0 - t) * (0.35 + 0.65 * aLevel);
}
`;

const FRAGMENT = /* glsl */ `
varying vec3 vColor;
varying float vFade;

void main() {
  // Round, soft-edged points; a square particle reads as a pixel bug.
  float d = length(gl_PointCoord - vec2(0.5));
  float alpha = (1.0 - smoothstep(0.34, 0.5, d)) * vFade;
  if (alpha <= 0.01) discard;
  gl_FragColor = vec4(vColor, alpha);
}
`;

export function ParticleSphere({
  analyser,
  timeRef,
  followRef,
  className,
}: {
  analyser: SlidingSpectrogram;
  /** Playback position in seconds, mutated in place, never state. */
  timeRef: { current: number };
  /** Whether the window should chase playback right now. */
  followRef: { current: boolean };
  className?: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      return; // No WebGL2.
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x05040a, 1);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";

    // --- the pool --------------------------------------------------------
    const directions = new Float32Array(POOL * 3);
    const births = new Float32Array(POOL);
    const speeds = new Float32Array(POOL);
    const lives = new Float32Array(POOL);
    const levels = new Float32Array(POOL);
    // Born long ago with a short life, so every slot starts dead.
    births.fill(-1e6);
    lives.fill(1);

    const geometry = new THREE.BufferGeometry();
    const dirAttr = new THREE.BufferAttribute(directions, 3);
    const birthAttr = new THREE.BufferAttribute(births, 1);
    const speedAttr = new THREE.BufferAttribute(speeds, 1);
    const lifeAttr = new THREE.BufferAttribute(lives, 1);
    const levelAttr = new THREE.BufferAttribute(levels, 1);
    // `position` carries the unit direction; the shader derives the rest.
    geometry.setAttribute("position", dirAttr);
    geometry.setAttribute("aBirth", birthAttr);
    geometry.setAttribute("aSpeed", speedAttr);
    geometry.setAttribute("aLife", lifeAttr);
    geometry.setAttribute("aLevel", levelAttr);
    const attributes = [dirAttr, birthAttr, speedAttr, lifeAttr, levelAttr];

    let config: SphereState = { ...sphereState() };
    const uniforms = {
      uTime: { value: 0 },
      uSize: { value: config.size },
      uCore: { value: config.core },
      uDrag: { value: config.drag },
      uSwirl: { value: config.swirl },
    };

    // The shader derives a position from a particle's age, so changing the
    // settle time re-shapes particles that are already in flight rather
    // than only the next ones. For a tuning control that is the right
    // trade: you see the whole cloud respond instead of waiting a
    // lifetime for the old ones to clear.
    const unsubscribe = subscribeSphere((next) => {
      config = { ...next };
      uniforms.uSize.value = config.size;
      uniforms.uCore.value = config.core;
      uniforms.uDrag.value = config.drag;
      uniforms.uSwirl.value = config.swirl;
    });
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;

    const scene = new THREE.Scene();
    scene.add(points);

    // --- emission --------------------------------------------------------
    let cursor = 0;
    let emissions = 0;
    /** Lowest and highest pool slot written this frame. */
    let dirtyFrom = POOL;
    let dirtyTo = 0;

    const emit = (band: number, level: number, at: number) => {
      const slot = cursor;
      cursor = (cursor + 1) % POOL;
      dirtyFrom = Math.min(dirtyFrom, slot);
      dirtyTo = Math.max(dirtyTo, slot);

      // Latitude is frequency, uniform in cos so the sphere is covered
      // evenly rather than bunching at the poles. A little jitter gives
      // each ring thickness.
      const u = analyser.bands > 1 ? band / (analyser.bands - 1) : 0.5;
      const cosTheta = Math.max(
        -1,
        Math.min(1, -1 + 2 * u + (Math.random() - 0.5) * config.spread),
      );
      const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
      const phi = emissions * GOLDEN_ANGLE;
      emissions++;

      directions[slot * 3] = sinTheta * Math.cos(phi);
      directions[slot * 3 + 1] = cosTheta;
      directions[slot * 3 + 2] = sinTheta * Math.sin(phi);
      births[slot] = at;
      // Speed comes from the reach you asked for, divided by the settle
      // time — so "max reach" stays a distance you can see rather than a
      // number that drifts whenever the drag is changed.
      const fraction =
        config.quietReach + level * (1 - config.quietReach);
      speeds[slot] = (fraction * config.reach) / Math.max(0.01, config.drag);
      lives[slot] =
        config.life * (1 - LIFE_JITTER + Math.random() * LIFE_JITTER * 2);
      levels[slot] = level;
    };

    /** Fires one slice of the ring. */
    const emitSlice = (row: number, at: number) => {
      const base = row * analyser.bands;
      for (let band = 0; band < analyser.bands; band++) {
        const level = analyser.levels[base + band];
        if (level >= config.floor) emit(band, level, at);
      }
    };

    const flush = () => {
      if (dirtyTo < dirtyFrom) return;
      for (const attribute of attributes) {
        attribute.clearUpdateRanges();
        // One contiguous run unless the ring wrapped, in which case the
        // whole buffer is cheaper than reasoning about two ranges.
        attribute.addUpdateRange(
          dirtyFrom * attribute.itemSize,
          (dirtyTo - dirtyFrom + 1) * attribute.itemSize,
        );
        attribute.needsUpdate = true;
      }
      dirtyFrom = POOL;
      dirtyTo = 0;
    };

    // --- view ------------------------------------------------------------
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
    camera.position.set(0, 6, 34);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 6;
    controls.maxDistance = 160;
    controls.update();

    const resize = () => {
      const { clientWidth, clientHeight } = mount;
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
    let lastHead = -1;
    let frame = 0;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      // The shader's clock. Kept relative to mount so a highp float does
      // not lose its grip on the fractions after a few minutes.
      const clock = (now - origin) / 1000;
      uniforms.uTime.value = clock;

      if (followRef.current) analyser.advanceTo(timeRef.current);

      // Fire every slice that arrived since the last frame, so particle
      // density stays proportional to time rather than to frame rate.
      const head = analyser.head;
      if (head !== lastHead) {
        if (lastHead < 0) {
          emitSlice(head, clock);
        } else {
          const frames = analyser.frames;
          let steps = (head - lastHead + frames) % frames;
          // A jump bigger than the window is a seek; one slice is enough
          // to restart from rather than firing a whole window at once.
          if (steps > frames / 2) steps = 1;
          for (let i = steps; i >= 1; i--) {
            emitSlice((head - i + 1 + frames) % frames, clock);
          }
        }
        lastHead = head;
        flush();
      }

      controls.update();
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
      observer.disconnect();
      controls.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
    // Rebuilt only for a different song; the refs are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyser]);

  return <div ref={mountRef} className={className} />;
}
