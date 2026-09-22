"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { SlidingSpectrogram } from "./song-spectrogram";

/**
 * The spectrogram of a song as a cloud of particles that a user can
 * walk around.
 *
 * There are three axes, one for each dimension of the data. X is the
 * time across the full analysed interval. Z is the frequency, log-spaced
 * with the bass nearest. Y is the level, thus the height of a particle
 * is the loudness of that band at that moment. The result is a
 * landscape: a bass line is a ridge at the front, a hi-hat pattern is a
 * row of spikes at the back, and a drop is a cliff across each band.
 *
 * The cloud uses points and not a surface mesh. This is the subject of
 * the page and also the form of the data: a spectrogram is a grid of
 * discrete measurements. A skin across them would show a continuity
 * between adjacent cells that the transform did not measure.
 *
 * The cloud follows the playback. The window slides with the audio that
 * the user hears, thus the newest slice is always the current moment and
 * the cloud scrolls through the song. That edge is lit, thus the current
 * moment is visible with no separate marker.
 *
 * The window slides, thus the point count stays the same at each cell of
 * the grid, and the shader hides the quiet cells instead of the code
 * removing them from the buffer. To remove them would reallocate the
 * geometry at each frame as the loud cells move. Most of the grid is
 * almost silent, thus a hidden cell keeps the shape above readable and
 * does not put it on a dark carpet.
 *
 * Use only ASCII characters in the GLSL. WebGL rejects source that
 * contains characters outside the GLSL ES set, comments included, and it
 * rejects the source before the compiler runs.
 */

/** The box that holds the cloud, in world units. */
const SPAN_X = 44;
const SPAN_Z = 18;
const HEIGHT = 11;

/** The shader does not draw a cell with a level below this value. */
const FLOOR = 0.07;

const VERTEX = /* glsl */ `
attribute float aLevel;

uniform float uSize;
uniform float uPlayhead;   // world x of the lit edge that shows "now"
uniform float uFloor;      // the shader hides a cell below this level

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
  vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewPos;

  // The shader hides an almost silent cell. The code does not remove it
  // from the buffer, because the window slides: the loud cells change
  // each few milliseconds and the geometry must stay the same.
  if (aLevel < uFloor) {
    gl_PointSize = 0.0;
    vColor = vec3(0.0);
    vFade = 0.0;
    return;
  }

  // A perspective-correct size, with a minimum. Thus a distant quiet
  // cell stays visible as dust and does not disappear.
  gl_PointSize = uSize * (0.45 + aLevel) * (320.0 / max(1.0, -viewPos.z));

  // A band of brightness follows the playhead, thus the position in the
  // song is visible with no separate marker.
  float near = 1.0 - smoothstep(0.0, 1.4, abs(position.x - uPlayhead));
  vColor = ramp(aLevel) * (0.35 + 0.65 * aLevel) * (1.0 + 2.2 * near);
  vFade = 0.35 + 0.65 * aLevel;
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

export function ParticleField({
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

    // --- the grid, one point per cell ------------------------------------
    const { frames, bands } = analyser;
    const count = frames * bands;
    const positions = new Float32Array(count * 3);
    const strengths = new Float32Array(count);

    // x and z do not move. The position of a cell on the time axis and
    // on the frequency axis is constant, and only its height and its
    // level change as the window slides. Thus the code writes x and z one
    // time.
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
     * Reads the ring into the buffers, with the oldest slice at the back.
     *
     * Only y and the level change, thus the x and z written above stay.
     * This removes a third of the writes at each frame of the playback.
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
      // The newest slice is the current moment, thus the lit edge is the
      // front of the cloud. There is no separate playhead to position.
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

    // A faint floor grid, thus the time axis and the frequency axis stay
    // readable where the cloud is empty.
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
      // Write the buffers only when the levels changed. At 60 fps there
      // are frames between two slices, and a scrub during a pause can end
      // on the same ring index. Thus this code reads the revision and not
      // the head.
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
    // Rebuilt only for another song. The refs are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyser]);

  return <div ref={mountRef} className={className} />;
}
