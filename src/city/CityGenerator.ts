import * as THREE from 'three';
import { RNG } from '../utils/rng';
import { DISTRICTS, pickFamily } from './DistrictManager';
import { rollBuilding, buildTowerParts, buildSkyway, type TowerPart, type PartKind } from './BuildingFactory';
import { buildingVertexShader, buildingFragmentShader } from '../shaders/buildingShader';

interface Layer {
  kind: PartKind;
  mesh: THREE.InstancedMesh;
  capacity: number;
  count: number;
}

/**
 * Dense brutalist megacity — multi-part instanced towers, skyways, horizon ring.
 * buildingCount ≈ number of towers; actual draw instances are several× that.
 */
export class CityGenerator {
  readonly group = new THREE.Group();
  readonly material: THREE.ShaderMaterial;
  readonly count: number;
  private layers: Record<PartKind, Layer>;
  private horizon: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private corePos = new THREE.Vector3(0, 48, -10);
  private occupied = new Set<string>();

  constructor(buildingCount: number, seed = 0xfc17) {
    this.count = buildingCount;
    const rng = new RNG(seed);

    this.material = new THREE.ShaderMaterial({
      vertexShader: buildingVertexShader,
      fragmentShader: buildingFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uFracture: { value: 0 },
        uGravity: { value: 0 },
        uFold: { value: 0 },
        uDissolve: { value: 0 },
        uGhost: { value: 0 },
        uFogDensity: { value: 0.00135 },
        uFogColor: { value: new THREE.Color(0x060a14) },
        uCameraPos: { value: new THREE.Vector3() },
        uCorePos: { value: this.corePos.clone() },
        uCyan: { value: new THREE.Color(0x4de8ff) },
        uMagenta: { value: new THREE.Color(0xff3d9a) },
      },
    });

    // Capacity heuristics: avg ~4.2 volumes, ~1.2 details, bridges/strips separate
    const volCap = Math.ceil(buildingCount * 5.2);
    const detCap = Math.ceil(buildingCount * 1.8);
    const bridgeCap = 220;
    const stripCap = 220;

    this.layers = {
      volume: this.makeLayer('volume', volCap),
      detail: this.makeLayer('detail', detCap),
      bridge: this.makeLayer('bridge', bridgeCap),
      strip: this.makeLayer('strip', stripCap),
    };

    this.addTerrain(rng);
    this.placeDistricts(rng, buildingCount);
    this.placeHeroMegatowers(rng);
    this.placeSkyways(rng);
    this.horizon = this.placeHorizon(rng);

    for (const layer of Object.values(this.layers)) {
      layer.mesh.count = layer.count;
      layer.mesh.instanceMatrix.needsUpdate = true;
      this.group.add(layer.mesh);
    }
    this.group.add(this.horizon);
  }

  private makeLayer(kind: PartKind, capacity: number): Layer {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    // Slightly denser UVs on taller faces help window grids read
    const mesh = new THREE.InstancedMesh(geo, this.material, capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;

    const colorAttr = new Float32Array(capacity * 3);
    const seedAttr = new Float32Array(capacity);
    const emissiveAttr = new Float32Array(capacity);
    geo.setAttribute('instanceColorAttr', new THREE.InstancedBufferAttribute(colorAttr, 3));
    geo.setAttribute('instanceSeed', new THREE.InstancedBufferAttribute(seedAttr, 1));
    geo.setAttribute('instanceEmissive', new THREE.InstancedBufferAttribute(emissiveAttr, 1));

    return { kind, mesh, capacity, count: 0 };
  }

  private cellKey(x: number, z: number): string {
    return `${Math.round(x / 12)}_${Math.round(z / 12)}`;
  }

  private tryOccupy(x: number, z: number): boolean {
    const k = this.cellKey(x, z);
    if (this.occupied.has(k)) return false;
    this.occupied.add(k);
    return true;
  }

  private addPart(p: TowerPart): boolean {
    const layer = this.layers[p.kind];
    if (layer.count >= layer.capacity) return false;
    const i = layer.count++;
    this.dummy.position.set(p.x, p.y, p.z);
    this.dummy.scale.set(p.sx, p.sy, p.sz);
    this.dummy.rotation.set(p.rx, p.ry, p.rz);
    this.dummy.updateMatrix();
    layer.mesh.setMatrixAt(i, this.dummy.matrix);

    const colorAttr = layer.mesh.geometry.getAttribute('instanceColorAttr') as THREE.InstancedBufferAttribute;
    const seedAttr = layer.mesh.geometry.getAttribute('instanceSeed') as THREE.InstancedBufferAttribute;
    const emissiveAttr = layer.mesh.geometry.getAttribute('instanceEmissive') as THREE.InstancedBufferAttribute;
    colorAttr.setXYZ(i, p.color.r, p.color.g, p.color.b);
    seedAttr.setX(i, p.seed);
    emissiveAttr.setX(i, p.emissive);
    return true;
  }

  private addTerrain(rng: RNG): void {
    // Layered ground — wet asphalt plate + raised plaza blocks, not a flat demo plane
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x04060c,
      roughness: 0.92,
      metalness: 0.15,
      emissive: 0x0a1422,
      emissiveIntensity: 0.12,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.2;
    this.group.add(ground);

    // Street canyon gutters as dark recessed strips (instanced slabs)
    const gutterMat = new THREE.MeshStandardMaterial({
      color: 0x02040a,
      roughness: 1,
      metalness: 0.05,
      emissive: 0x081018,
      emissiveIntensity: 0.2,
    });
    const gutterGeo = new THREE.BoxGeometry(1, 1, 1);
    const gutterCount = 48;
    const gutters = new THREE.InstancedMesh(gutterGeo, gutterMat, gutterCount);
    let gi = 0;
    for (let g = -11; g <= 11 && gi < gutterCount; g++) {
      // N-S gutter
      this.dummy.position.set(g * 36, 0.15, 0);
      this.dummy.scale.set(3.2, 0.4, 720);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.updateMatrix();
      gutters.setMatrixAt(gi++, this.dummy.matrix);
      if (gi >= gutterCount) break;
      // E-W gutter
      this.dummy.position.set(0, 0.15, g * 36);
      this.dummy.scale.set(720, 0.4, 3.2);
      this.dummy.updateMatrix();
      gutters.setMatrixAt(gi++, this.dummy.matrix);
    }
    gutters.count = gi;
    this.group.add(gutters);

    // Occasional raised plaza pads
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x080c16,
      roughness: 0.85,
      metalness: 0.2,
      emissive: 0x101828,
      emissiveIntensity: 0.08,
    });
    for (let i = 0; i < 18; i++) {
      const pad = new THREE.Mesh(new THREE.BoxGeometry(rng.range(20, 55), 1.2, rng.range(20, 55)), padMat);
      pad.position.set(rng.range(-280, 280), 0.4, rng.range(-280, 280));
      this.group.add(pad);
    }
  }

  private placeDistricts(rng: RNG, buildingCount: number): void {
    const densSum = DISTRICTS.reduce((a, d) => a + d.density, 0);
    let placed = 0;

    for (const district of DISTRICTS) {
      const n = Math.floor((district.density / densSum) * buildingCount);
      for (let k = 0; k < n && placed < buildingCount; k++) {
        const ang = rng.next() * Math.PI * 2;
        // Bias density toward center of district (more packed cores)
        const rad = Math.pow(rng.next(), 0.65) * district.radius;
        let x = district.cx + Math.cos(ang) * rad;
        let z = district.cz + Math.sin(ang) * rad;

        // Street gutters: snap to 18m grid with small jitter, avoid exact gutter centers
        const cell = 18;
        x = Math.round(x / cell) * cell + rng.range(-3.5, 3.5);
        z = Math.round(z / cell) * cell + rng.range(-3.5, 3.5);
        // Keep clear of main gutters every 36m
        if (Math.abs(x % 36) < 4 || Math.abs(z % 36) < 4) {
          x += 8;
          z += 8;
        }

        if (!this.tryOccupy(x, z)) continue;

        const family = pickFamily(district, rng.next());
        const spec = rollBuilding(family, rng);
        spec.height *= district.heightScale * rng.range(0.88, 1.18);
        const yaw = rng.range(-0.12, 0.12);

        const parts = buildTowerParts(family, spec, x, z, yaw, rng);
        for (const p of parts) this.addPart(p);
        placed++;
      }
    }

    // Fill remainder with dense midrise scatter in the near/mid field
    while (placed < buildingCount) {
      const x = rng.range(-260, 260);
      const z = rng.range(-200, 320);
      if (!this.tryOccupy(x, z)) {
        placed++;
        continue;
      }
      const family = rng.pick(['midrise', 'vertical', 'industrial'] as const);
      const spec = rollBuilding(family, rng);
      const parts = buildTowerParts(family, spec, x, z, rng.range(-0.1, 0.1), rng);
      for (const p of parts) this.addPart(p);
      placed++;
    }
  }

  /** Explicit hero megatowers framing the camera descent corridor */
  private placeHeroMegatowers(rng: RNG): void {
    const anchors: Array<[number, number, number]> = [
      [-52, 140, 1.7],
      [58, 155, 1.85],
      [-68, 220, 1.55],
      [72, 240, 1.6],
      [-40, 90, 1.45],
      [48, 100, 1.5],
      [-85, 300, 1.4],
      [90, 310, 1.35],
      [0, 40, 1.2],
      [-30, -60, 1.3],
      [35, -80, 1.25],
    ];
    for (const [ax, az, hScale] of anchors) {
      const x = ax + rng.range(-4, 4);
      const z = az + rng.range(-4, 4);
      this.tryOccupy(x, z);
      const family = rng.chance(0.7) ? 'megatower' : 'vertical';
      const spec = rollBuilding(family, rng);
      spec.height *= hScale;
      const parts = buildTowerParts(family, spec, x, z, rng.range(-0.05, 0.05), rng);
      for (const p of parts) this.addPart(p);
    }
  }

  private placeSkyways(rng: RNG): void {
    // Multi-elevation transit decks — long beams across the canyon
    const levels = [42, 68, 95, 125, 160];
    for (let i = 0; i < 55; i++) {
      const y = rng.pick(levels) + rng.range(-6, 6);
      const x1 = rng.range(-220, 220);
      const z1 = rng.range(-180, 340);
      const len = rng.range(50, 180);
      const ang = rng.pick([0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]) + rng.range(-0.08, 0.08);
      const x2 = x1 + Math.sin(ang) * len;
      const z2 = z1 + Math.cos(ang) * len;
      const parts = buildSkyway(x1, z1, x2, z2, y, rng);
      for (const p of parts) this.addPart(p);
    }

    // Cross-canyon hero skyways over the camera path
    for (const y of [55, 88, 118]) {
      const parts = buildSkyway(-90, 130 + (y - 55) * 0.4, 95, 145 + (y - 55) * 0.3, y, rng);
      for (const p of parts) this.addPart(p);
    }
  }

  private placeHorizon(rng: RNG): THREE.InstancedMesh {
    const count = 72;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x04070e,
      transparent: true,
      opacity: 0.92,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;

    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + rng.range(-0.05, 0.05);
      const r = rng.range(480, 720);
      const h = rng.range(140, 420);
      const w = rng.range(28, 90);
      const d = rng.range(28, 90);
      // Stacked silhouette: base + shaft suggestion via scale only (dark card)
      this.dummy.position.set(Math.cos(ang) * r, h * 0.5, Math.sin(ang) * r);
      this.dummy.scale.set(w, h, d);
      this.dummy.rotation.set(0, ang + Math.PI / 2, 0);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(i, this.dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    // Second nearer ring of mid-silhouette towers
    const midCount = 40;
    const mid = new THREE.InstancedMesh(geo, mat.clone(), midCount);
    mid.frustumCulled = false;
    for (let i = 0; i < midCount; i++) {
      const ang = rng.next() * Math.PI * 2;
      const r = rng.range(340, 460);
      const h = rng.range(100, 280);
      this.dummy.position.set(Math.cos(ang) * r, h * 0.5, Math.sin(ang) * r);
      this.dummy.scale.set(rng.range(18, 50), h, rng.range(18, 50));
      this.dummy.rotation.set(0, ang, 0);
      this.dummy.updateMatrix();
      mid.setMatrixAt(i, this.dummy.matrix);
    }
    mid.instanceMatrix.needsUpdate = true;
    this.group.add(mid);

    return mesh;
  }

  update(
    time: number,
    cameraPos: THREE.Vector3,
    knobs: {
      fracture: number;
      gravity: number;
      fold: number;
      dissolve: number;
      ghost: number;
    }
  ): void {
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uFracture.value = knobs.fracture;
    u.uGravity.value = knobs.gravity;
    u.uFold.value = knobs.fold;
    u.uDissolve.value = knobs.dissolve;
    u.uGhost.value = knobs.ghost;
    u.uCameraPos.value.copy(cameraPos);
    u.uCorePos.value.copy(this.corePos);
    // Fog thickens with fracture, clears toward finale (handled in App via setFog too)
    u.uFogDensity.value = 0.00125 + knobs.fracture * 0.0005 + knobs.ghost * 0.0003;
  }

  setVisible(v: boolean): void {
    this.group.visible = v;
  }

  dispose(): void {
    for (const layer of Object.values(this.layers)) {
      layer.mesh.geometry.dispose();
    }
    this.material.dispose();
    this.horizon.geometry.dispose();
    (this.horizon.material as THREE.Material).dispose();
  }
}
