import type { BuildingFamily } from './BuildingFactory';

export type DistrictId =
  | 'central_core'
  | 'industrial_canyon'
  | 'vertical_slums'
  | 'skyway_network'
  | 'fracture_zone'
  | 'collapse_core'
  | 'hero_corridor'
  | 'horizon_ring';

export interface DistrictDef {
  id: DistrictId;
  label: string;
  cx: number;
  cz: number;
  radius: number;
  density: number;
  families: BuildingFamily[];
  weights: number[];
  heightScale: number;
  /** Prefer placing along camera approach corridor */
  hero?: boolean;
}

/**
 * Layout keyed to the camera approach along +Z → origin.
 * Hero corridor frames descent; far districts fill the silhouette.
 */
export const DISTRICTS: DistrictDef[] = [
  {
    id: 'hero_corridor',
    label: 'Hero Corridor',
    cx: 0,
    cz: 160,
    radius: 95,
    density: 1.55,
    families: ['megatower', 'vertical', 'midrise'],
    weights: [0.5, 0.3, 0.2],
    heightScale: 1.55,
    hero: true,
  },
  {
    id: 'central_core',
    label: 'Central Core',
    cx: 0,
    cz: 0,
    radius: 85,
    density: 1.35,
    families: ['megatower', 'midrise', 'vertical'],
    weights: [0.4, 0.35, 0.25],
    heightScale: 1.25,
  },
  {
    id: 'industrial_canyon',
    label: 'Industrial Canyon',
    cx: -190,
    cz: 50,
    radius: 130,
    density: 0.95,
    families: ['industrial', 'midrise', 'transit'],
    weights: [0.55, 0.25, 0.2],
    heightScale: 0.75,
  },
  {
    id: 'vertical_slums',
    label: 'Vertical Slums',
    cx: 170,
    cz: -20,
    radius: 120,
    density: 1.6,
    families: ['vertical', 'midrise', 'anomaly'],
    weights: [0.55, 0.3, 0.15],
    heightScale: 1.15,
  },
  {
    id: 'skyway_network',
    label: 'Skyway Network',
    cx: 30,
    cz: 220,
    radius: 140,
    density: 0.7,
    families: ['transit', 'midrise', 'megatower'],
    weights: [0.4, 0.35, 0.25],
    heightScale: 0.9,
  },
  {
    id: 'fracture_zone',
    label: 'Fracture Zone',
    cx: -70,
    cz: -160,
    radius: 110,
    density: 1.05,
    families: ['anomaly', 'megatower', 'vertical'],
    weights: [0.45, 0.3, 0.25],
    heightScale: 1.3,
  },
  {
    id: 'collapse_core',
    label: 'Collapse Core',
    cx: 15,
    cz: -35,
    radius: 50,
    density: 0.45,
    families: ['anomaly', 'megatower'],
    weights: [0.75, 0.25],
    heightScale: 0.85,
  },
];

export function pickFamily(d: DistrictDef, r: number): BuildingFamily {
  let acc = 0;
  for (let i = 0; i < d.families.length; i++) {
    acc += d.weights[i];
    if (r <= acc) return d.families[i];
  }
  return d.families[0];
}
