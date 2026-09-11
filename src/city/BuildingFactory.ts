import * as THREE from 'three';
import { RNG } from '../utils/rng';

export type BuildingFamily =
  | 'megatower'
  | 'midrise'
  | 'industrial'
  | 'transit'
  | 'vertical'
  | 'anomaly';

export type PartKind = 'volume' | 'detail' | 'bridge' | 'strip';

export interface BuildingSpec {
  family: BuildingFamily;
  width: number;
  depth: number;
  height: number;
  color: THREE.Color;
  emissive: number;
  seed: number;
}

/** One transformable box part belonging to a tower / skyway */
export interface TowerPart {
  kind: PartKind;
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  ry: number;
  rx: number;
  rz: number;
  color: THREE.Color;
  emissive: number;
  seed: number;
}

const _c = new THREE.Color();

export function rollBuilding(family: BuildingFamily, rng: RNG): BuildingSpec {
  let width = 6;
  let depth = 6;
  let height = 40;
  let emissive = 0.7;
  const color = new THREE.Color();

  switch (family) {
    case 'megatower':
      width = rng.range(18, 36);
      depth = rng.range(18, 36);
      height = rng.range(200, 420);
      emissive = rng.range(0.8, 1.25);
      color.setHSL(0.58, 0.12, rng.range(0.045, 0.1));
      break;
    case 'midrise':
      width = rng.range(8, 18);
      depth = rng.range(8, 18);
      height = rng.range(36, 110);
      emissive = rng.range(0.55, 1.0);
      color.setHSL(0.6, 0.1, rng.range(0.045, 0.1));
      break;
    case 'industrial':
      width = rng.range(18, 42);
      depth = rng.range(14, 36);
      height = rng.range(22, 70);
      emissive = rng.range(0.15, 0.45);
      color.setHSL(0.08, 0.08, rng.range(0.04, 0.08));
      break;
    case 'transit':
      width = rng.range(5, 10);
      depth = rng.range(28, 80);
      height = rng.range(10, 28);
      emissive = rng.range(0.35, 0.7);
      color.setHSL(0.55, 0.15, 0.08);
      break;
    case 'vertical':
      width = rng.range(7, 14);
      depth = rng.range(7, 14);
      height = rng.range(100, 260);
      emissive = rng.range(0.7, 1.1);
      color.setHSL(0.62, 0.14, rng.range(0.045, 0.095));
      break;
    case 'anomaly':
      width = rng.range(10, 22);
      depth = rng.range(10, 22);
      height = rng.range(50, 180);
      emissive = rng.range(0.9, 1.35);
      color.setHSL(0.82, 0.28, 0.09);
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

/**
 * Expand a building into multi-part brutalist geometry:
 * podium + shaft setbacks + crown + optional antenna / industrial extras.
 */
export function buildTowerParts(
  family: BuildingFamily,
  spec: BuildingSpec,
  x: number,
  z: number,
  yaw: number,
  rng: RNG
): TowerPart[] {
  const parts: TowerPart[] = [];
  const h = spec.height;
  const w0 = spec.width;
  const d0 = spec.depth;
  const seed = spec.seed;
  const baseColor = spec.color.clone();
  const em = spec.emissive;

  const push = (
    kind: PartKind,
    px: number,
    py: number,
    pz: number,
    sx: number,
    sy: number,
    sz: number,
    opts: { ry?: number; rx?: number; rz?: number; color?: THREE.Color; emissive?: number; seed?: number } = {}
  ) => {
    parts.push({
      kind,
      x: px,
      y: py,
      z: pz,
      sx,
      sy,
      sz,
      ry: opts.ry ?? yaw,
      rx: opts.rx ?? 0,
      rz: opts.rz ?? 0,
      color: (opts.color ?? baseColor).clone(),
      emissive: opts.emissive ?? em,
      seed: opts.seed ?? seed,
    });
  };

  // --- PODIUM ---
  const podiumH = Math.max(4, h * rng.range(0.06, 0.12));
  const podiumW = w0 * rng.range(1.15, 1.45);
  const podiumD = d0 * rng.range(1.15, 1.45);
  push('volume', x, podiumH * 0.5, z, podiumW, podiumH, podiumD, {
    color: baseColor.clone().multiplyScalar(0.85),
    emissive: em * 0.55,
  });

  // --- STACKED SHAFT WITH SETBACKS ---
  let y = podiumH;
  let cw = w0;
  let cd = d0;
  const segments =
    family === 'megatower' ? rng.int(3, 5) : family === 'midrise' ? rng.int(2, 3) : family === 'vertical' ? rng.int(3, 6) : rng.int(1, 3);

  const shaftBudget = h - podiumH - h * 0.08;
  for (let s = 0; s < segments; s++) {
    const frac = rng.range(0.18, 0.38);
    const segH = shaftBudget * (s === segments - 1 ? Math.max(0.2, 1 - (segments - 1) * 0.28) : frac);
    const actualH = Math.max(6, segH);
    push('volume', x, y + actualH * 0.5, z, cw, actualH, cd);

    // Habitation balcony offsets / terraces
    if (family === 'vertical' || family === 'midrise' || (family === 'megatower' && rng.chance(0.55))) {
      const balconies = rng.int(1, family === 'vertical' ? 4 : 2);
      for (let b = 0; b < balconies; b++) {
        const side = rng.pick([-1, 1]);
        const along = rng.pick(['x', 'z'] as const);
        const bh = rng.range(1.2, 2.4);
        const by = y + rng.range(0.15, 0.85) * actualH;
        if (along === 'x') {
          push('volume', x + side * (cw * 0.5 + 1.2), by, z + rng.range(-cd * 0.3, cd * 0.3), rng.range(2.5, 5), bh, rng.range(cw * 0.35, cw * 0.7), {
            emissive: em * 0.7,
            seed: seed + 0.1 * b,
          });
        } else {
          push('volume', x + rng.range(-cw * 0.3, cw * 0.3), by, z + side * (cd * 0.5 + 1.2), rng.range(cd * 0.35, cd * 0.7), bh, rng.range(2.5, 5), {
            emissive: em * 0.7,
            seed: seed + 0.1 * b,
          });
        }
      }
    }

    y += actualH;
    // Setback
    const shrink = family === 'megatower' ? rng.range(0.82, 0.94) : rng.range(0.88, 0.97);
    cw *= shrink;
    cd *= shrink;
  }

  // --- CROWN ---
  const crownH = Math.max(3, h * rng.range(0.04, 0.09));
  const crownW = cw * rng.range(0.7, 1.05);
  const crownD = cd * rng.range(0.7, 1.05);
  push('volume', x, y + crownH * 0.5, z, crownW, crownH, crownD, {
    color: baseColor.clone().offsetHSL(0, 0, 0.02),
    emissive: em * 1.1,
  });
  y += crownH;

  // Mechanical crown platform
  if (family === 'megatower' || family === 'anomaly' || rng.chance(0.35)) {
    const platH = rng.range(1.5, 3.5);
    push('volume', x, y + platH * 0.5, z, crownW * 1.15, platH, crownD * 1.15, {
      emissive: em * 0.4,
    });
    y += platH;
  }

  // --- ANTENNA / SPIRE ---
  if (family === 'megatower' || family === 'vertical' || family === 'anomaly' || rng.chance(0.25)) {
    const antH = h * rng.range(0.08, 0.22);
    const antW = rng.range(0.6, 1.8);
    push('detail', x, y + antH * 0.5, z, antW, antH, antW, {
      emissive: em * 0.3,
      seed: seed + 0.33,
    });
    // tip beacon
    push('detail', x, y + antH + 1.2, z, 1.4, 2.4, 1.4, {
      color: _c.set(0x1a3040).clone(),
      emissive: 1.4,
      seed: seed + 0.5,
    });
  }

  // --- INDUSTRIAL EXTRAS ---
  if (family === 'industrial') {
    const stacks = rng.int(2, 5);
    for (let i = 0; i < stacks; i++) {
      const ch = rng.range(h * 0.4, h * 1.3);
      const cr = rng.range(1.5, 4);
      const ox = x + rng.range(-w0 * 0.35, w0 * 0.35);
      const oz = z + rng.range(-d0 * 0.35, d0 * 0.35);
      push('detail', ox, podiumH + ch * 0.5, oz, cr, ch, cr, {
        emissive: 0.2,
        seed: seed + i * 0.07,
      });
    }
    // pipe runs
    for (let i = 0; i < rng.int(1, 3); i++) {
      const len = rng.range(w0 * 0.6, w0 * 1.4);
      push('detail', x, podiumH + rng.range(4, h * 0.5), z + rng.range(-d0 * 0.5, d0 * 0.5), len, rng.range(0.8, 1.6), rng.range(0.8, 1.6), {
        ry: yaw + rng.range(-0.2, 0.2),
        emissive: 0.15,
      });
    }
  }

  // Anomaly baked tilt on volumes
  if (family === 'anomaly') {
    const tx = rng.range(-0.12, 0.12);
    const tz = rng.range(-0.12, 0.12);
    for (const p of parts) {
      if (p.kind === 'volume') {
        p.rx += tx;
        p.rz += tz;
      }
    }
  }

  return parts;
}

/** Long skyway beam + thickness + cables + glowing underside strip */
export function buildSkyway(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  y: number,
  rng: RNG
): TowerPart[] {
  const parts: TowerPart[] = [];
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len < 8) return parts;
  const mx = (x1 + x2) * 0.5;
  const mz = (z1 + z2) * 0.5;
  const ry = Math.atan2(dx, dz);
  const thick = rng.range(5.5, 11);
  const beamH = rng.range(2.2, 4.5);

  // Main deck
  parts.push({
    kind: 'bridge',
    x: mx,
    y,
    z: mz,
    sx: thick,
    sy: beamH,
    sz: len,
    ry,
    rx: 0,
    rz: 0,
    color: new THREE.Color().setHSL(0.55, 0.08, 0.07),
    emissive: 0.28,
    seed: rng.next(),
  });

  // Side rails for thickness read
  const nx = Math.cos(ry); // lateral in XZ after yaw around Y
  const nz = -Math.sin(ry);
  for (const side of [-1, 1]) {
    parts.push({
      kind: 'bridge',
      x: mx + side * nx * (thick * 0.48),
      y: y + beamH * 0.55,
      z: mz + side * nz * (thick * 0.48),
      sx: 0.55,
      sy: rng.range(1.2, 2.2),
      sz: len * 0.98,
      ry,
      rx: 0,
      rz: 0,
      color: new THREE.Color().setHSL(0.55, 0.1, 0.08),
      emissive: 0.2,
      seed: rng.next(),
    });
  }

  // Glowing underside strip
  parts.push({
    kind: 'strip',
    x: mx,
    y: y - beamH * 0.58,
    z: mz,
    sx: thick * 0.4,
    sy: 0.4,
    sz: len * 0.98,
    ry,
    rx: 0,
    rz: 0,
    color: new THREE.Color(0x4de8ff),
    emissive: 1.85,
    seed: rng.next(),
  });

  // Support pylons at ends
  const pylonH = y;
  for (const [px, pz] of [
    [x1, z1],
    [x2, z2],
  ] as [number, number][]) {
    parts.push({
      kind: 'detail',
      x: px,
      y: pylonH * 0.5,
      z: pz,
      sx: rng.range(2.8, 5),
      sy: pylonH,
      sz: rng.range(2.8, 5),
      ry,
      rx: 0,
      rz: 0,
      color: new THREE.Color().setHSL(0.55, 0.1, 0.06),
      emissive: 0.22,
      seed: rng.next(),
    });
  }

  // Suspension cables (thin details drooping from mid)
  const cableN = Math.min(6, Math.floor(len / 40));
  for (let c = 1; c <= cableN; c++) {
    const t = c / (cableN + 1);
    const cx = x1 + dx * t;
    const cz = z1 + dz * t;
    const sag = Math.sin(t * Math.PI) * rng.range(4, 10);
    parts.push({
      kind: 'detail',
      x: cx,
      y: y - sag * 0.5,
      z: cz,
      sx: 0.25,
      sy: sag,
      sz: 0.25,
      ry,
      rx: 0,
      rz: 0,
      color: new THREE.Color().setHSL(0.55, 0.05, 0.12),
      emissive: 0.15,
      seed: rng.next(),
    });
  }

  return parts;
}
