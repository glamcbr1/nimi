import * as THREE from 'three';

/**
 * Shared authored camera corridor — used by CameraDirector (flight)
 * AND CityGenerator (clearance tube + banked towers).
 *
 * Avenue runs roughly along +Z → origin → mild -Z, centered on X≈0.
 * Street canyon width ~50; clearance tube radius 24–36 on XZ.
 */

export const AVENUE_HALF_WIDTH = 26;
export const CLEARANCE_RADIUS = 30;
export const CLEARANCE_RADIUS_CANYON = 34;
export const STREET_WIDTH = 52;

/** Camera world positions along scroll (Catmull-Rom). Keep X near 0 until late surreal. */
export const CAMERA_PATH_POINTS: THREE.Vector3[] = [
  // INTRO — high & far, skyline establishing shot
  new THREE.Vector3(0, 310, 760),
  new THREE.Vector3(0, 275, 620),
  new THREE.Vector3(0, 230, 500),
  // DESCENT — drop into central avenue (still centered)
  new THREE.Vector3(0, 160, 390),
  new THREE.Vector3(0, 95, 300),
  // CANYON — low flythrough, dead-center corridor
  new THREE.Vector3(0, 42, 220),
  new THREE.Vector3(0, 36, 150),
  new THREE.Vector3(0, 34, 80),
  new THREE.Vector3(0, 36, 20),
  // APPROACH CORE — still on avenue, slight rise
  new THREE.Vector3(0, 44, -30),
  new THREE.Vector3(2, 52, -70),
  // GENTLE SURREAL — tiny lateral drift only after city earned trust
  new THREE.Vector3(-6, 58, -100),
  new THREE.Vector3(4, 50, -55),
  // CORE — approach wound from corridor
  new THREE.Vector3(0, 48, -5),
  // SILENCE — slow drift
  new THREE.Vector3(8, 55, -40),
  // FINALE — pull back outside city to spherical structure
  new THREE.Vector3(0, 95, 160),
  new THREE.Vector3(0, 70, 340),
  new THREE.Vector3(0, 55, 420),
];

/** Look-at targets stay ahead along the avenue — never into side walls. */
export const CAMERA_LOOK_POINTS: THREE.Vector3[] = [
  new THREE.Vector3(0, 120, 280),
  new THREE.Vector3(0, 100, 200),
  new THREE.Vector3(0, 80, 140),
  new THREE.Vector3(0, 55, 100),
  new THREE.Vector3(0, 42, 60),
  new THREE.Vector3(0, 38, 40),
  new THREE.Vector3(0, 36, -10),
  new THREE.Vector3(0, 34, -50),
  new THREE.Vector3(0, 36, -90),
  new THREE.Vector3(0, 42, -120),
  new THREE.Vector3(0, 48, -100),
  new THREE.Vector3(0, 48, -40),
  new THREE.Vector3(0, 48, -20),
  new THREE.Vector3(0, 48, -15),
  new THREE.Vector3(0, 40, -60),
  new THREE.Vector3(0, 20, -80),
  new THREE.Vector3(0, 10, -100),
  new THREE.Vector3(0, 0, -120),
];

let _camCurve: THREE.CatmullRomCurve3 | null = null;
let _lookCurve: THREE.CatmullRomCurve3 | null = null;
let _samples: THREE.Vector3[] | null = null;

export function getCameraCurve(): THREE.CatmullRomCurve3 {
  if (!_camCurve) {
    _camCurve = new THREE.CatmullRomCurve3(CAMERA_PATH_POINTS, false, 'catmullrom', 0.22);
  }
  return _camCurve;
}

export function getLookCurve(): THREE.CatmullRomCurve3 {
  if (!_lookCurve) {
    _lookCurve = new THREE.CatmullRomCurve3(CAMERA_LOOK_POINTS, false, 'catmullrom', 0.22);
  }
  return _lookCurve;
}

/** Dense XZ samples of the camera path for clearance tests. */
export function getPathSamples(segments = 128): THREE.Vector3[] {
  if (_samples && _samples.length === segments + 1) return _samples;
  const curve = getCameraCurve();
  _samples = [];
  for (let i = 0; i <= segments; i++) {
    _samples.push(curve.getPoint(i / segments));
  }
  return _samples;
}

/**
 * Horizontal (XZ) distance from a world point to the nearest camera-path sample.
 * Optional yGate: only consider samples whose Y is within yGate of queryY
 * (used so high skyways don't collide with low path samples incorrectly —
 * for buildings we ignore Y and clear the full tube).
 */
export function distToCameraPathXZ(x: number, z: number): number {
  const samples = getPathSamples();
  let best = Infinity;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const dx = x - s.x;
    const dz = z - s.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < best) best = d;
  }
  return best;
}

/** Clearance radius varies: wider in the low canyon (y < 80 on path). */
export function clearanceRadiusAt(x: number, z: number): number {
  const samples = getPathSamples();
  let best = Infinity;
  let bestY = 40;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const dx = x - s.x;
    const dz = z - s.z;
    const d = dx * dx + dz * dz;
    if (d < best) {
      best = d;
      bestY = s.y;
    }
  }
  // Wider tube when camera is low in the canyon
  if (bestY < 80) return CLEARANCE_RADIUS_CANYON;
  if (bestY < 160) return CLEARANCE_RADIUS;
  return 24;
}

/**
 * True if a building footprint of half-extent `halfW` would intersect the
 * clearance tube around the camera path.
 */
export function intersectsClearanceTube(x: number, z: number, halfExtent = 10): boolean {
  const r = clearanceRadiusAt(x, z);
  return distToCameraPathXZ(x, z) - halfExtent < r;
}

/**
 * Bank placement helper: given a path sample index / progress, return
 * left/right bank anchor positions outside the clearance tube.
 */
export function bankPosition(
  pathT: number,
  side: -1 | 1,
  lateral: number,
  out = new THREE.Vector3()
): THREE.Vector3 {
  const curve = getCameraCurve();
  const p = curve.getPoint(THREE.MathUtils.clamp(pathT, 0, 1));
  const tangent = curve.getTangent(THREE.MathUtils.clamp(pathT, 0, 1)).normalize();
  // Perpendicular in XZ
  const nx = -tangent.z;
  const nz = tangent.x;
  const len = Math.hypot(nx, nz) || 1;
  out.set(p.x + side * (nx / len) * lateral, 0, p.z + side * (nz / len) * lateral);
  return out;
}
