"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { WATER_FRAGMENT_SHADER, WATER_VERTEX_SHADER } from "./water-shader";
import { flatDropK } from "@/app/_water/water-field";
import {
  LIGHT_DIR,
  MAX_DROPS,
  DEFAULT_DROP_CAPACITY,
  PLANE_SEGMENTS,
  PLANE_SIZE,
  WATER_COLORS,
  WATER_DEFAULTS,
  WIRE_SEGMENTS,
  type WaterParamKey,
  type WaterToggles,
} from "./water-params";

/**
 * The three.js side of the water-drop surface (spec sections 6-8).
 *
 * The GPU owns each wave. This file tracks only the events. A drop is
 * four floats, the origin x, the origin z, the start time and the
 * strength, written into a ring buffer of 16. The wave model is linear,
 * thus the shader sums the drops. One more drop costs one more loop
 * iteration and nothing else. A drop that is older than near 6*tau adds
 * no measurable height, thus a write over the oldest slot is not
 * visible.
 *
 * Two parts here are necessary and easy to break:
 *
 * - The `uDrops` uniform keeps the same array reference for the life of
 *   the scene, and the code mutates its `Vector4`s in place. A new array
 *   breaks the binding of three.
 * - A click raycasts an infinite math `Plane` and never the mesh. The
 *   raycaster of three tests the CPU geometry, which is not displaced,
 *   thus a test against the mesh would report the flat plane and would
 *   be slower.
 */

/** The commands that the control panel can send to the live scene. */
export interface WaterSceneApi {
  /** Drop at a world xz, or at a random position with no arguments. */
  drop: (x?: number, z?: number) => void;
  /** Remove each ripple and make the surface flat. */
  clear: () => void;
}

/** Fall acceleration. The true value, 980, is too fast to see, thus this
 *  is the slower value from section 7. */
const FALL_G = 60;
/** The height where a clicked drop starts, in world units. */
const FALL_HEIGHT = 12;
/** Upward speed of the droplet that the jet releases. */
const SECONDARY_V0 = 7;
const SECONDARY_STRENGTH = 0.35;
/** Seconds between two automatic drops, plus a maximum of one second of jitter. */
const AUTO_INTERVAL = 2.2;

/** A drop in flight, before it touches the surface. */
interface Projectile {
  mesh: THREE.Mesh;
  x: number;
  z: number;
  y0: number;
  v0: number;
  t0: number;
  strength: number;
  /** A primary drop releases a droplet from the jet. That droplet does not. */
  spawnsSecondary: boolean;
}

/** A droplet that waits for its jet to reach the peak. */
interface PendingSecondary {
  at: number;
  x: number;
  z: number;
}

/**
 * A vertical sky gradient in the palette of the water. It is the
 * environment of the scene, thus the falling bead reflects the same sky
 * that the surface shader reflects analytically.
 */
function makeSkyEnvironment(): THREE.DataTexture {
  const width = 4;
  const height = 64;
  const deep = new THREE.Color(WATER_COLORS.deep);
  const horizon = new THREE.Color(WATER_COLORS.horizon);
  const zenith = new THREE.Color(WATER_COLORS.zenith);
  const data = new Uint8Array(width * height * 4);
  const scratch = new THREE.Color();
  for (let y = 0; y < height; y++) {
    // Equirect rows run from the top, the zenith, to the bottom, which
    // is below the horizon.
    const v = y / (height - 1);
    if (v < 0.5) scratch.copy(zenith).lerp(horizon, v / 0.5);
    else scratch.copy(horizon).lerp(deep, (v - 0.5) / 0.5);
    const srgb = scratch.clone().convertLinearToSRGB();
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = Math.round(srgb.r * 255);
      data[i + 1] = Math.round(srgb.g * 255);
      data[i + 2] = Math.round(srgb.b * 255);
      data[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, width, height);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function WaterSurface({
  params,
  toggles,
  apiRef,
}: {
  params: Record<WaterParamKey, number>;
  toggles: WaterToggles;
  apiRef: React.RefObject<WaterSceneApi | null>;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const uniformsRef = useRef<Record<string, THREE.IUniform> | null>(null);
  const wireRef = useRef<THREE.Mesh | null>(null);
  const autoRef = useRef(toggles.autoDrops);
  /** Read when a jet reaches its peak, thus the droplet starts at the current jet height. */
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const pageStart = performance.now();
    /** Seconds after the mount. It stays small, thus the float precision stays good. */
    const clock = () => (performance.now() - pageStart) / 1000;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";

    const scene = new THREE.Scene();
    const environment = makeSkyEnvironment();
    scene.environment = environment;

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 400);
    camera.position.set(0, 14, 22);
    camera.lookAt(0, 0, 0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 6;
    controls.maxDistance = 90;
    // Stay above the sheet. The surface is single-sided, and a height
    // field shows nothing from below.
    controls.maxPolarAngle = Math.PI / 2 - 0.04;

    // --- drop bookkeeping (spec section 8) -------------------------------
    const drops = Array.from(
      { length: MAX_DROPS },
      () => new THREE.Vector4(0, 0, -1e6, 0),
    );
    let head = 0;
    let count = 0;

    const uniforms: Record<string, THREE.IUniform> = {
      uTime: { value: 0 },
      uDropCount: { value: 0 },
      uDrops: { value: drops },
      // Each drop uses uK. Only the audio visualizer changes it.
      uDropK: { value: flatDropK() },
      uMode: { value: toggles.heightView ? 1 : 0 },
      uDispersion: { value: toggles.dispersion ? 1 : 0 },
      uDeep: { value: new THREE.Color(WATER_COLORS.deep) },
      uHorizon: { value: new THREE.Color(WATER_COLORS.horizon) },
      uZenith: { value: new THREE.Color(WATER_COLORS.zenith) },
      uLightDir: { value: new THREE.Vector3(...LIGHT_DIR) },
      uLift: { value: 0 },
      uAlpha: { value: 1 },
    };
    for (const key of Object.keys(WATER_DEFAULTS) as WaterParamKey[]) {
      uniforms[key] = { value: params[key] ?? WATER_DEFAULTS[key] };
    }
    uniformsRef.current = uniforms;

    function addDrop(x: number, z: number, strength = 1) {
      drops[head].set(x, z, clock(), strength);
      head = (head + 1) % DEFAULT_DROP_CAPACITY;
      count = Math.min(count + 1, DEFAULT_DROP_CAPACITY);
      uniforms.uDropCount.value = count;
    }

    // --- the surface -----------------------------------------------------
    const geometry = new THREE.PlaneGeometry(
      PLANE_SIZE,
      PLANE_SIZE,
      PLANE_SEGMENTS,
      PLANE_SEGMENTS,
    );
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: WATER_VERTEX_SHADER,
      fragmentShader: WATER_FRAGMENT_SHADER,
    });
    const mesh = new THREE.Mesh(geometry, material);
    // The jet moves vertices far above the plane that gave the bounding
    // sphere. Thus let the GPU decide what is on the screen.
    mesh.frustumCulled = false;
    scene.add(mesh);

    // A coarse wireframe overlay for the technical view. It uses the same
    // uniform objects, thus each slider drives both meshes. Only the lift
    // and the alpha are its own.
    const wireGeometry = new THREE.PlaneGeometry(
      PLANE_SIZE,
      PLANE_SIZE,
      WIRE_SEGMENTS,
      WIRE_SEGMENTS,
    );
    wireGeometry.rotateX(-Math.PI / 2);
    const wireMaterial = new THREE.ShaderMaterial({
      uniforms: { ...uniforms, uLift: { value: 0.03 }, uAlpha: { value: 0.32 } },
      vertexShader: WATER_VERTEX_SHADER,
      fragmentShader: WATER_FRAGMENT_SHADER,
      wireframe: true,
      transparent: true,
      depthWrite: false,
    });
    const wireMesh = new THREE.Mesh(wireGeometry, wireMaterial);
    wireMesh.frustumCulled = false;
    wireMesh.visible = toggles.wireframe;
    wireMesh.renderOrder = 1;
    scene.add(wireMesh);
    wireRef.current = wireMesh;

    // --- the falling drop (spec section 7) -------------------------------
    const light = new THREE.DirectionalLight(0xffffff, 2.4);
    light.position.set(...LIGHT_DIR).multiplyScalar(10);
    scene.add(light);
    scene.add(
      new THREE.HemisphereLight(
        new THREE.Color(WATER_COLORS.zenith),
        new THREE.Color(WATER_COLORS.deep),
        0.7,
      ),
    );

    const beadGeometry = new THREE.SphereGeometry(0.25, 24, 16);
    const beadMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#cfeaff"),
      roughness: 0.06,
      metalness: 0,
      envMapIntensity: 1.4,
    });

    const projectiles: Projectile[] = [];
    const pending: PendingSecondary[] = [];

    function launch(
      x: number,
      z: number,
      y0: number,
      v0: number,
      strength: number,
      radius: number,
      spawnsSecondary: boolean,
    ) {
      const bead = new THREE.Mesh(beadGeometry, beadMaterial);
      bead.scale.setScalar(radius / 0.25);
      bead.position.set(x, y0, z);
      scene.add(bead);
      projectiles.push({
        mesh: bead,
        x,
        z,
        y0,
        v0,
        t0: clock(),
        strength,
        spawnsSecondary,
      });
    }

    const half = PLANE_SIZE / 2;
    function dropAt(x?: number, z?: number) {
      // A click near the horizon can intersect the plane hundreds of
      // units away. Keep each drop on the sheet that the scene draws.
      const spread = half * 0.8;
      const px = THREE.MathUtils.clamp(
        x ?? (Math.random() * 2 - 1) * spread,
        -half,
        half,
      );
      const pz = THREE.MathUtils.clamp(
        z ?? (Math.random() * 2 - 1) * spread,
        -half,
        half,
      );
      launch(px, pz, FALL_HEIGHT, 0, 1, 0.25, true);
    }

    function clearDrops() {
      for (const drop of drops) drop.set(0, 0, -1e6, 0);
      head = 0;
      count = 0;
      uniforms.uDropCount.value = 0;
      pending.length = 0;
      for (const p of projectiles) scene.remove(p.mesh);
      projectiles.length = 0;
    }

    apiRef.current = { drop: dropAt, clear: clearDrops };

    function stepProjectiles(t: number) {
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        const age = t - p.t0;
        const y = p.y0 + p.v0 * age - 0.5 * FALL_G * age * age;
        if (y <= 0) {
          scene.remove(p.mesh);
          projectiles.splice(i, 1);
          addDrop(p.x, p.z, p.strength);
          if (p.spawnsSecondary) {
            // The jet must rise before it can release a droplet.
            pending.push({ at: t + paramsRef.current.uJetTau, x: p.x, z: p.z });
          }
          continue;
        }
        p.mesh.position.set(p.x, y, p.z);
      }

      for (let i = pending.length - 1; i >= 0; i--) {
        if (t < pending[i].at) continue;
        const { x, z } = pending[i];
        pending.splice(i, 1);
        const { uJetB, uHeightScale } = paramsRef.current;
        const peak = Math.max(0.2, uJetB * uHeightScale * 0.9);
        launch(x, z, peak, SECONDARY_V0, SECONDARY_STRENGTH, 0.12, false);
      }
    }

    // --- click to drop (spec section 8) ----------------------------------
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    let downX = 0;
    let downY = 0;
    let downAt = 0;

    const onPointerDown = (event: PointerEvent) => {
      downX = event.clientX;
      downY = event.clientY;
      downAt = performance.now();
    };
    const onPointerUp = (event: PointerEvent) => {
      if (event.button !== 0) return;
      // Do not drop on the pointer-up that ends an orbit drag.
      const moved = Math.hypot(event.clientX - downX, event.clientY - downY);
      if (moved > 6 || performance.now() - downAt > 600) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(groundPlane, hit)) dropAt(hit.x, hit.z);
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    // --- sizing ----------------------------------------------------------
    const resize = () => {
      const { clientWidth, clientHeight } = mount;
      if (!clientWidth || !clientHeight) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      // Keep updateStyle on. It gives the canvas its CSS size. Without
      // that size the canvas lays out at its device-pixel size.
      renderer.setSize(clientWidth, clientHeight);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    window.addEventListener("resize", resize);

    // --- loop ------------------------------------------------------------
    let nextAuto = 0.4;
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const t = clock();
      uniforms.uTime.value = t;
      if (autoRef.current && t >= nextAuto) {
        dropAt();
        nextAuto = t + AUTO_INTERVAL + Math.random();
      }
      stepProjectiles(t);
      controls.update();
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      apiRef.current = null;
      uniformsRef.current = null;
      wireRef.current = null;
      controls.dispose();
      geometry.dispose();
      wireGeometry.dispose();
      material.dispose();
      wireMaterial.dispose();
      beadGeometry.dispose();
      beadMaterial.dispose();
      environment.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
    // Built one time. The params and the toggles reach the live scene
    // through the two effects below, thus this effect does not run again
    // and no shader is recompiled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The sliders write directly into the uniform objects. React does not
  // render the scene again, no material is rebuilt and no shader is
  // recompiled.
  useEffect(() => {
    const uniforms = uniformsRef.current;
    if (!uniforms) return;
    for (const key of Object.keys(params) as WaterParamKey[]) {
      const uniform = uniforms[key];
      if (uniform) uniform.value = params[key];
    }
  }, [params]);

  useEffect(() => {
    const uniforms = uniformsRef.current;
    autoRef.current = toggles.autoDrops;
    if (wireRef.current) wireRef.current.visible = toggles.wireframe;
    if (!uniforms) return;
    uniforms.uMode.value = toggles.heightView ? 1 : 0;
    uniforms.uDispersion.value = toggles.dispersion ? 1 : 0;
  }, [toggles]);

  return (
    <div
      ref={mountRef}
      className="absolute inset-0"
      style={{
        background:
          "radial-gradient(120% 90% at 50% 0%, #16324a 0%, #0c1c2b 45%, #060d15 100%)",
      }}
    />
  );
}
