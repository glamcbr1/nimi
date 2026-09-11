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

/** Camera world positions — denser early points = longer hero holds on scroll. */
export const CAMERA_PATH_POINTS: THREE.Vector3[] = [
  // INTRO postcard — high, looking into dense lit skyline (hold)
  new THREE.Vector3(0, 330, 820),
  new THREE.Vector3(0, 315, 740),
  new THREE.Vector3(0, 295, 670),
  new THREE.Vector3(0, 270, 600),
  // DESCENT — deliberate drop into central avenue
  new THREE.Vector3(0, 220, 520),
  new THREE.Vector3(0, 165, 440),
  new THREE.Vector3(0, 110, 360),
  // CANYON — low under skyway, towers left/right (hold)
  new THREE.Vector3(0, 48, 280),
  new THREE.Vector3(0, 40, 230),
  new THREE.Vector3(0, 36, 180),
  new THREE.Vector3(0, 34, 130),
  new THREE.Vector3(0, 34, 80),
  new THREE.Vector3(0, 36, 35),
  // APPROACH CORE — mild rise, still corridor
  new THREE.Vector3(0, 42, -10),
  new THREE.Vector3(1, 50, -55),
  // GENTLE SURREAL — tiny lateral only after trust
  new THREE.Vector3(-5, 56, -95),
  new THREE.Vector3(3, 50, -50),
  // CORE
  new THREE.Vector3(0, 48, -5),
  // SILENCE
  new THREE.Vector3(6, 54, -35),
  // FINALE pullback
  new THREE.Vector3(0, 90, 150),
  new THREE.Vector3(0, 68, 320),
  new THREE.Vector3(0, 52, 430),
];

/** Look-at targets stay ahead along the avenue — never into side walls. */
export const CAMERA_LOOK_POINTS: THREE.Vector3[] = [
  new THREE.Vector3(0, 130, 300),
  new THREE.Vector3(0, 120, 260),
  new THREE.Vector3(0, 110, 220),
  new THREE.Vector3(0, 95, 180),
  new THREE.Vector3(0, 75, 140),
  new THREE.Vector3(0, 55, 100),
  new THREE.Vector3(0, 45, 70),
  new THREE.Vector3(0, 40, 50),
  new THREE.Vector3(0, 38, 20),
  new THREE.Vector3(0, 36, -10),
  new THREE.Vector3(0, 34, -40),
  new THREE.Vector3(0, 36, -70),
  new THREE.Vector3(0, 38, -100),
  new THREE.Vector3(0, 42, -120),
  new THREE.Vector3(0, 48, -100),
  new THREE.Vector3(0, 48, -45),
  new THREE.Vector3(0, 48, -20),
  new THREE.Vector3(0, 48, -15),
  new THREE.Vector3(0, 40, -55),
  new THREE.Vector3(0, 18, -80),
  new THREE.Vector3(0, 8, -100),
  new THREE.Vector3(0, 0, -120),
];

let _camCurve: THREE.CatmullRomCurve3 | null = null;
let _lookCurve: THREE.CatmullRomCurve3 | null = null;
let _samples: THREE.Vector3[] | null = null;

export function getCameraCurve(): THREE.CatmullRomCurve3 {
  if (!_camCurve) {
    _camCurve = new THREE.CatmullRomCurve3(CAMERA_PATH_POINTS, false, 'catmullrom', 0.2);
  }
  return _camCurve;
}

export function getLookCurve(): THREE.CatmullRomCurve3 {
  if (!_lookCurve) {
    _lookCurve = new THREE.CatmullRomCurve3(CAMERA_LOOK_POINTS, false, 'catmullrom', 0.2);
  }
  return _lookCurve;
}

export function getPathSamples(segments = 128): THREE.Vector3[] {
  if (_samples && _samples.length === segments + 1) return _samples;
  const curve = getCameraCurve();
  _samples = [];
  for (let i = 0; i <= segments; i++) {
    _samples.push(curve.getPoint(i / segments));
  }
  return _samples;
}

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
  if (bestY < 80) return CLEARANCE_RADIUS_CANYON;
  if (bestY < 160) return CLEARANCE_RADIUS;
  return 24;
}

export function intersectsClearanceTube(x: number, z: number, halfExtent = 10): boolean {
  const r = clearanceRadiusAt(x, z);
  return distToCameraPathXZ(x, z) - halfExtent < r;
}

export function bankPosition(
  pathT: number,
  side: -1 | 1,
  lateral: number,
  out = new THREE.Vector3()
): THREE.Vector3 {
  const curve = getCameraCurve();
  const p = curve.getPoint(THREE.MathUtils.clamp(pathT, 0, 1));
  const tangent = curve.getTangent(THREE.MathUtils.clamp(pathT, 0, 1)).normalize();
  const nx = -tangent.z;
  const nz = tangent.x;
  const len = Math.hypot(nx, nz) || 1;
  out.set(p.x + side * (nx / len) * lateral, 0, p.z + side * (nz / len) * lateral);
  return out;
}
