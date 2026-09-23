"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

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
 *
 * The scene is shared, thus it takes a ring of levels and a function
 * that advances it, and it knows nothing of where they come from.
 * `/particles` hands it the offline window of a decoded preview, whose
 * `SlidingSpectrogram` already is such a ring, and the Music Player
 * hands it a ring that a live analyser fills one row at a time
 * (`GridVisualizer.tsx`). The curl field and the core are shared the
 * same way, with a `sample` function. A ring and not a `sample` here,
 * because this scene draws the history itself and not only the current
 * moment: a caller that owns the history can also scrub it.
 */

/**
 * A ring of spectrum slices. `head` is the row of the newest one, and
 * the scene reads back from it. `version` changes whenever `levels`
 * changed, thus the scene writes its buffers again only then.
 */
export interface LevelHistory {
  frames: number;
  bands: number;
  levels: Float32Array;
  head: number;
  version: number;
}

/** The box that holds the cloud, in world units. */
const SPAN_X = 44;
const SPAN_Z = 18;
const HEIGHT = 11;

/** The shader does not draw a cell with a level below this value. */
const FLOOR = 0.07;

/**
 * The point size, and the height of the mount that it is right for.
 *
 * `gl_PointSize` is in pixels and the framing is by field of view, thus
 * a smaller mount shows the same cloud with the same fat points and the
 * landscape becomes a blur. The tile of the Music Player is a fifth of
 * the height of `/particles`. Thus the size follows the height of the
 * mount and the scene keeps its proportions at any size.
 */
const POINT_SIZE = 2.6;
const POINT_SIZE_AT = 700;

/** The three-quarter view that the camera starts from, as polar values. */
const VIEW_AZIMUTH = Math.atan2(-SPAN_X * 0.42, SPAN_Z * 1.9);
const VIEW_RADIUS = Math.hypot(SPAN_X * 0.42, SPAN_Z * 1.9);
const VIEW_HEIGHT = HEIGHT * 1.9;

/**
 * The sway of the view where there is no orbit, in radians and in
 * radians a second.
 *
 * The camera sways about the start angle and does not turn full circle.
 * The x axis is the time with the newest slice at the lit edge, thus a
 * full turn would put the landscape the wrong way round for half of it.
 */
const SWAY = 0.32;
const SWAY_RATE = 0.16;

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
  history,
  advance,
  orbit = true,
  paused = false,
  className = "h-full w-full",
}: {
  /** The slices to draw. The component reads it, it does not own it. */
  history: LevelHistory;
  /**
   * Brings `history` up to date. The component calls it one time a
   * frame, before it looks at `version`. The caller does the work of
   * its own source in it: move an offline window to the playback
   * position, or push one row from a live analyser.
   */
  advance: () => void;
  /**
   * Whether a drag orbits the camera. The dashboard sets it to false:
   * its visualizer is in a 10-foot UI, where a canvas must not take the
   * pointer. The view sways on its own instead.
   */
  orbit?: boolean;
  /**
   * Freezes the picture. The component still paints, thus the canvas
   * does not go blank, but no slice arrives and the view holds.
   */
  paused?: boolean;
  /**
   * Classes for the mount. They must give the element a height: the
   * canvas takes its size from this element, and a block div with no
   * height leaves the renderer at its default 300x150.
   */
  className?: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  // Written after the render and not during it. The loop reads them on
  // the next frame, thus one frame of an old value is not observable.
  const advanceRef = useRef(advance);
  const pausedRef = useRef(paused);
  useEffect(() => {
    advanceRef.current = advance;
    pausedRef.current = paused;
  });

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
    const { frames, bands } = history;
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
      const { levels, head } = history;
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
      uSize: { value: POINT_SIZE },
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
    camera.position.set(-SPAN_X * 0.42, VIEW_HEIGHT, SPAN_Z * 1.9);

    let controls: OrbitControls | null = null;
    if (orbit) {
      controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, HEIGHT * 0.3, 0);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.maxPolarAngle = Math.PI / 2 - 0.02;
      controls.minDistance = 8;
      controls.maxDistance = 140;
      controls.update();
    }

    const resize = () => {
      const { clientWidth, clientHeight } = mount;
      if (!clientWidth || !clientHeight) return;
      renderer.setSize(clientWidth, clientHeight);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      // A floor on the scale: below it the quiet dust disappears and
      // only the ridges stay, which is worse than points a little large.
      uniforms.uSize.value =
        POINT_SIZE * Math.max(0.45, Math.min(1, clientHeight / POINT_SIZE_AT));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const origin = performance.now();
    /** The moment the clock stopped, or -1 while it runs. */
    let frozenAt = -1;
    /** Total ms spent stopped, thus a resume continues and does not jump. */
    let frozen = 0;
    let frame = 0;
    let seen = -1;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);

      // Freeze the clock and not the frame, as the core and the water
      // tile do. The canvas keeps painting, thus it does not go blank,
      // but no slice arrives and the view holds where it was.
      const still = motion.matches || pausedRef.current;
      if (still && frozenAt < 0) frozenAt = now;
      if (!still && frozenAt >= 0) {
        frozen += now - frozenAt;
        frozenAt = -1;
      }
      const t = ((still ? frozenAt : now) - origin - frozen) / 1000;

      if (!still) advanceRef.current();
      // Write the buffers only when the levels changed. At 60 fps there
      // are frames between two slices, and a scrub during a pause can end
      // on the same ring index. Thus this code reads the revision and not
      // the head.
      if (history.version !== seen) {
        seen = history.version;
        refresh();
      }

      if (controls) {
        controls.update();
      } else {
        // There is no orbit here, thus the view sways on its own. A
        // fixed three-quarter view of a landscape looks like a still
        // image, and the cells alone do not show that it is not one.
        const angle = VIEW_AZIMUTH + Math.sin(t * SWAY_RATE) * SWAY;
        camera.position.set(
          Math.sin(angle) * VIEW_RADIUS,
          VIEW_HEIGHT,
          Math.cos(angle) * VIEW_RADIUS,
        );
        camera.lookAt(0, HEIGHT * 0.3, 0);
      }
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls?.dispose();
      geometry.dispose();
      material.dispose();
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
    // Rebuilt only for another ring or another orbit mode. The advance
    // function and the paused flag reach the loop through a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, orbit]);

  return <div ref={mountRef} className={className} />;
}
