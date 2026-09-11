import * as THREE from 'three';
import { RNG } from '../utils/rng';

export type BuildingFamily =
  | 'megatower'
  | 'midrise'
  | 'industrial'
  | 'transit'
  | 'vertical'
  | 'anomaly';

export interface BuildingSpec {
  family: BuildingFamily;
  width: number;
  depth: number;
  height: number;
  color: THREE.Color;
  emissive: number;
  seed: number;
}

const FAMILY_GEO: Record<BuildingFamily, THREE.BufferGeometry> = {
  megatower: new THREE.BoxGeometry(1, 1, 1),
  midrise: new THREE.BoxGeometry(1, 1, 1),
  industrial: new THREE.BoxGeometry(1, 1, 1),
  transit: new THREE.BoxGeometry(1, 1, 1),
  vertical: new THREE.BoxGeometry(1, 1, 1),
  anomaly: new THREE.BoxGeometry(1, 1, 1),
};

export function createFamilyGeometry(family: BuildingFamily, rng: RNG): THREE.BufferGeometry {
  // Slightly varied silhouettes via merged boxes — keep simple for instancing: use single box with non-uniform scale
  void family;
  void rng;
  return FAMILY_GEO.megatower;
}

export function rollBuilding(family: BuildingFamily, rng: RNG): BuildingSpec {
  let width = 6;
  let depth = 6;
  let height = 40;
  let emissive = 0.7;
  const color = new THREE.Color();

  switch (family) {
    case 'megatower':
      width = rng.range(10, 22);
      depth = rng.range(10, 22);
      height = rng.range(120, 280);
      emissive = rng.range(0.7, 1.1);
      color.setHSL(0.62, 0.15, rng.range(0.08, 0.16));
      break;
    case 'midrise':
      width = rng.range(6, 14);
      depth = rng.range(6, 14);
      height = rng.range(28, 90);
      emissive = rng.range(0.5, 0.95);
      color.setHSL(0.6, 0.12, rng.range(0.06, 0.14));
      break;
    case 'industrial':
      width = rng.range(14, 32);
      depth = rng.range(10, 28);
      height = rng.range(16, 55);
      emissive = rng.range(0.2, 0.55);
      color.setHSL(0.08, 0.1, rng.range(0.05, 0.1));
      break;
    case 'transit':
      width = rng.range(4, 8);
      depth = rng.range(20, 60);
      height = rng.range(8, 22);
      emissive = rng.range(0.4, 0.8);
      color.setHSL(0.55, 0.2, 0.1);
      break;
    case 'vertical':
      width = rng.range(5, 10);
      depth = rng.range(5, 10);
      height = rng.range(60, 160);
      emissive = rng.range(0.6, 1.0);
      color.setHSL(0.7, 0.18, rng.range(0.07, 0.13));
      break;
    case 'anomaly':
      width = rng.range(8, 18);
      depth = rng.range(8, 18);
      height = rng.range(40, 140);
      emissive = rng.range(0.9, 1.3);
      color.setHSL(0.85, 0.35, 0.12);
      break;
  }

  return {
    family,
    width,
    depth,
    height,
    color,
    emissive,
    seed: rng.next(),
  };
}
