import type { BuildingFamily } from './BuildingFactory';

export type DistrictId =
  | 'central_core'
  | 'industrial_canyon'
  | 'vertical_slums'
  | 'skyway_network'
  | 'fracture_zone'
  | 'collapse_core';

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
}

export const DISTRICTS: DistrictDef[] = [
  {
    id: 'central_core',
    label: 'Central Core',
    cx: 0,
    cz: 0,
    radius: 90,
    density: 1.2,
    families: ['megatower', 'midrise', 'vertical'],
    weights: [0.45, 0.35, 0.2],
    heightScale: 1.35,
  },
  {
    id: 'industrial_canyon',
    label: 'Industrial Canyon',
    cx: -160,
    cz: 40,
    radius: 110,
    density: 0.75,
    families: ['industrial', 'midrise', 'transit'],
    weights: [0.55, 0.25, 0.2],
    heightScale: 0.7,
  },
  {
    id: 'vertical_slums',
    label: 'Vertical Slums',
    cx: 140,
    cz: -30,
    radius: 100,
    density: 1.4,
    families: ['vertical', 'midrise', 'anomaly'],
    weights: [0.5, 0.35, 0.15],
    heightScale: 1.1,
  },
  {
    id: 'skyway_network',
    label: 'Skyway Network',
    cx: 40,
    cz: 150,
    radius: 120,
    density: 0.55,
    families: ['transit', 'midrise', 'megatower'],
    weights: [0.45, 0.35, 0.2],
    heightScale: 0.85,
  },
  {
    id: 'fracture_zone',
    label: 'Fracture Zone',
    cx: -60,
    cz: -140,
    radius: 100,
    density: 0.9,
    families: ['anomaly', 'megatower', 'vertical'],
    weights: [0.4, 0.35, 0.25],
    heightScale: 1.2,
  },
  {
    id: 'collapse_core',
    label: 'Collapse Core',
    cx: 20,
    cz: -40,
    radius: 55,
    density: 0.4,
    families: ['anomaly', 'megatower'],
    weights: [0.7, 0.3],
    heightScale: 0.9,
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
