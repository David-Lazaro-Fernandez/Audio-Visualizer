"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { SlidingSpectrogram } from "./song-spectrogram";

/**
 * A song's spectrogram as a cloud of particles you can walk around.
 *
 * Three axes, one per dimension of the data: **x is time** across the
 * whole interval analysed, **z is frequency** (log-spaced, bass nearest),
 * and **y is level** — so a particle's height *is* how loud that band was
 * at that moment. The result is a landscape: a bass line is a ridge along
 * the front, a hi-hat pattern a row of spikes at the back, a drop a cliff
 * across every band at once.
 *
 * Points rather than a surface mesh, which is what the page is named
 * for and also what the data is: a spectrogram is a grid of discrete
 * measurements, and joining them into a skin implies a continuity
 * between neighbouring cells that the transform never measured.
 *
 * The cloud **follows playback**: the window slides with what is being
 * heard, so the newest slice is always the moment you are hearing and
 * the cloud scrolls through the song. That edge is lit, so "now" reads
 * without a separate marker.
 *
 * Because the window slides, the point count is fixed at every cell of
 * the grid and quiet cells are hidden by the shader rather than left out
 * of the buffer — dropping them would mean reallocating the geometry
 * every frame as the loud cells moved. Most of the grid is near silence,
 * so hiding rather than drawing it is what keeps the shape above legible
 * instead of sitting on a dark carpet.
 *
 * Keep the GLSL ASCII-only: WebGL rejects source containing characters
 * outside the GLSL ES set, comments included, and reports it before the
 * compiler runs.
 */

/** The box the cloud is drawn in, in world units. */
const SPAN_X = 44;
const SPAN_Z = 18;
const HEIGHT = 11;

/** Cells quieter than this are not drawn at all. */
const FLOOR = 0.07;

const VERTEX = /* glsl */ `
attribute float aLevel;

uniform float uSize;
uniform float uPlayhead;   // world x of the lit "now" edge
uniform float uFloor;      // cells quieter than this are not drawn

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
  vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewPos;

  // Near-silent cells are hidden here rather than left out of the
  // buffer: the window slides, so which cells are loud changes every
  // few milliseconds and the geometry must not be reallocated for it.
  if (aLevel < uFloor) {
    gl_PointSize = 0.0;
    vColor = vec3(0.0);
    vFade = 0.0;
    return;
  }

  // Perspective-correct size, plus a floor so distant quiet cells stay
  // visible as dust rather than vanishing.
  gl_PointSize = uSize * (0.45 + aLevel) * (320.0 / max(1.0, -viewPos.z));

  // A band of brightness follows the playhead, so you can see where in
  // the song you are without a separate marker to read.
  float near = 1.0 - smoothstep(0.0, 1.4, abs(position.x - uPlayhead));
  vColor = ramp(aLevel) * (0.35 + 0.65 * aLevel) * (1.0 + 2.2 * near);
  vFade = 0.35 + 0.65 * aLevel;
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

export function ParticleField({
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

    // --- the grid, one point per cell ------------------------------------
    const { frames, bands } = analyser;
    const count = frames * bands;
    const positions = new Float32Array(count * 3);
    const strengths = new Float32Array(count);

    // x and z never move: a cell's place on the time and frequency axes
    // is fixed, and only its height and level change as the window
    // slides. So they are written once.
    for (let age = 0; age < frames; age++) {
      const x = (1 - age / Math.max(1, frames - 1) - 0.5) * SPAN_X;
      for (let band = 0; band < bands; band++) {
        const i = (age * bands + band) * 3;
        positions[i] = x;
        positions[i + 2] = (band / Math.max(1, bands - 1) - 0.5) * SPAN_Z;
      }
    }

    const geometry = new THREE.BufferGeometry();
    const positionAttribute = new THREE.BufferAttribute(positions, 3);
    const levelAttribute = new THREE.BufferAttribute(strengths, 1);
    geometry.setAttribute("position", positionAttribute);
    geometry.setAttribute("aLevel", levelAttribute);

    /**
     * Reads the ring into the buffers, oldest slice at the back.
     *
     * Only y and the level change, so the x/z written above are left
     * alone — a third of the writes saved on every frame of playback.
     */
    const refresh = () => {
      const { levels, head } = analyser;
      for (let age = 0; age < frames; age++) {
        const row = (((head - age) % frames) + frames) % frames;
        for (let band = 0; band < bands; band++) {
          const cell = age * bands + band;
          const level = levels[row * bands + band];
          strengths[cell] = level;
          positions[cell * 3 + 1] = level * HEIGHT;
        }
      }
      positionAttribute.needsUpdate = true;
      levelAttribute.needsUpdate = true;
    };
    refresh();

    const uniforms = {
      uSize: { value: 2.6 },
      // The newest slice is "now", so the lit edge is simply the front of
      // the cloud. There is no separate playhead to place.
      uPlayhead: { value: SPAN_X / 2 },
      uFloor: { value: FLOOR },
    };
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

    // A faint floor grid, so the time and frequency axes are readable
    // even where the cloud is empty.
    const grid = new THREE.GridHelper(SPAN_X, 24, 0x2a3355, 0x161a2e);
    grid.scale.z = SPAN_Z / SPAN_X;
    scene.add(grid);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
    camera.position.set(-SPAN_X * 0.42, HEIGHT * 1.9, SPAN_Z * 1.9);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, HEIGHT * 0.3, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = 8;
    controls.maxDistance = 140;
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

    let frame = 0;
    let seen = -1;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (followRef.current) analyser.advanceTo(timeRef.current);
      // Only touch the buffers when the levels actually changed. At 60 fps
      // there are frames between slices, and a scrub while paused can
      // land on the same ring index it was already on — which is why this
      // watches the revision and not the head.
      if (analyser.version !== seen) {
        seen = analyser.version;
        refresh();
      }
      controls.update();
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      geometry.dispose();
      material.dispose();
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
    // Rebuilt only for a different song; the refs are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyser]);

  return <div ref={mountRef} className={className} />;
}
