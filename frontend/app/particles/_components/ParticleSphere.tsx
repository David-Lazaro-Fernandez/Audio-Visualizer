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
 * The song as particles emitted from a sphere.
 *
 * The grid view shows the spectrogram as a landscape. This view emits
 * it. Each slice of the transform emits one particle for each band that
 * had energy. A particle starts on a small sphere, travels outward along
 * its own direction and then dies. Thus the frequency content becomes a
 * set of shells and not a surface.
 *
 * The mapping is what makes the view readable:
 *
 * - The direction is the frequency. The latitude comes from the band,
 *   with the bass at the south pole and the treble at the north pole,
 *   thus a band always leaves in the same ring. The longitude advances
 *   by the golden angle at each emission, which fills each ring equally
 *   and does not stack the particles on one meridian.
 * - The speed is the level. A loud band emits its particle with a high
 *   speed and the particle travels far. A quiet band emits a particle
 *   that stays near the core. Thus the radius shows the loudness, as the
 *   height does in the grid.
 * - The life is the time. A particle fades across a constant lifetime,
 *   thus the distance of a shell from the centre is also the time after
 *   the sound.
 *
 * The simulation is stateless on the GPU. The code writes the attributes
 * of a particle, which are the birth, the direction, the speed, the
 * lifetime and the level, one time at the emission. The vertex shader
 * then derives the position from `uTime - aBirth`. The CPU integrates
 * nothing and rewrites nothing at each frame. This is the only
 * affordable method: to upload a pool of 24,000 particles at each frame
 * is 38 MB/s of bus traffic for points that follow a closed-form path.
 * An emission writes a continuous range of the ring, thus the code
 * uploads only that range (`addUpdateRange`).
 *
 * Use only ASCII characters in the GLSL. WebGL rejects source that
 * contains characters outside the GLSL ES set, comments included, and it
 * rejects the source before the compiler runs.
 */

/**
 * Particles in the pool. With these settings near 11,000 are alive at a
 * time, thus the pool has more than two times the necessary capacity for
 * a dense passage.
 */
const POOL = 24000;
/**
 * The radius, the lifetime, the speed, the drag, the swirl and the
 * emission floor are all adjustable at run time from
 * `sphere-controls.ts`. The shape is the subject of the page, thus these
 * values must not be constants.
 */

/** Jitter on the lifetime of a particle, as a fraction, thus the shells are ragged. */
const LIFE_JITTER = 0.25;
/** Golden angle. It fills each latitude ring equally with time. */
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

/** The level scale that the visualizers of the dashboard also use. */
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
  // The particle is not born yet, or it is dead. Collapse it here and
  // do not branch around the code below, thus each invocation writes
  // gl_Position.
  if (age < 0.0 || age > aLife) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vColor = vec3(0.0);
    vFade = 0.0;
    return;
  }

  // Exponential drag: fast at the start, then slow. Thus the cloud has
  // an outer edge and does not expand without a limit.
  float reach = aSpeed * uDrag * (1.0 - exp(-age / uDrag));

  // A slow twist about the polar axis, thus the shells move past each
  // other and the sphere does not look like a static diagram.
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

  // The newest particles are the brightest, thus the first shell is the
  // current moment.
  vColor = ramp(aLevel) * (0.55 + 0.75 * (1.0 - t));
  vFade = (1.0 - t) * (0.35 + 0.65 * aLevel);
}
`;

const FRAGMENT = /* glsl */ `
varying vec3 vColor;
varying float vFade;

void main() {
  // Round points with soft edges. A square particle looks like a bug.
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
  /** Playback position in seconds. It is mutated in place, not state. */
  timeRef: { current: number };
  /** Whether the window must follow the playback now. */
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
      return; // There is no WebGL2.
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
    // An old birth with a short life, thus each slot starts dead.
    births.fill(-1e6);
    lives.fill(1);

    const geometry = new THREE.BufferGeometry();
    const dirAttr = new THREE.BufferAttribute(directions, 3);
    const birthAttr = new THREE.BufferAttribute(births, 1);
    const speedAttr = new THREE.BufferAttribute(speeds, 1);
    const lifeAttr = new THREE.BufferAttribute(lives, 1);
    const levelAttr = new THREE.BufferAttribute(levels, 1);
    // `position` holds the unit direction. The shader derives the rest.
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

    // The shader derives a position from the age of a particle, thus a
    // change to the settle time also changes the particles that are in
    // flight. For a tuning control this is correct: the full cloud
    // answers immediately, and you do not wait one lifetime for the old
    // particles to die.
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
    /** The lowest and the highest pool slot written at this frame. */
    let dirtyFrom = POOL;
    let dirtyTo = 0;

    const emit = (band: number, level: number, at: number) => {
      const slot = cursor;
      cursor = (cursor + 1) % POOL;
      dirtyFrom = Math.min(dirtyFrom, slot);
      dirtyTo = Math.max(dirtyTo, slot);

      // The latitude is the frequency. It is uniform in cos, thus the
      // particles cover the sphere equally and do not collect at the
      // poles. A small jitter gives each ring a thickness.
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
      // The speed is the selected reach divided by the settle time. Thus
      // the max reach stays a visible distance and does not change when
      // the drag changes.
      const fraction =
        config.quietReach + level * (1 - config.quietReach);
      speeds[slot] = (fraction * config.reach) / Math.max(0.01, config.drag);
      lives[slot] =
        config.life * (1 - LIFE_JITTER + Math.random() * LIFE_JITTER * 2);
      levels[slot] = level;
    };

    /** Emits the particles of one slice into the ring. */
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
        // One continuous range, if the ring did not wrap. After a wrap
        // the full buffer is less complex than two ranges.
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
      // The clock of the shader. It is relative to the mount, thus a
      // highp float keeps its fractions after some minutes.
      const clock = (now - origin) / 1000;
      uniforms.uTime.value = clock;

      if (followRef.current) analyser.advanceTo(timeRef.current);

      // Emit each slice that arrived after the last frame, thus the
      // particle density follows the time and not the frame rate.
      const head = analyser.head;
      if (head !== lastHead) {
        if (lastHead < 0) {
          emitSlice(head, clock);
        } else {
          const frames = analyser.frames;
          let steps = (head - lastHead + frames) % frames;
          // A jump that is longer than the window is a seek. One slice is
          // sufficient to restart, thus do not emit a full window.
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
    // Rebuilt only for another song. The refs are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyser]);

  return <div ref={mountRef} className={className} />;
}
