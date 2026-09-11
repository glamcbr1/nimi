import * as THREE from 'three';
import { RNG } from '../utils/rng';
import { pickFamily, type DistrictDef } from './DistrictManager';
import { rollBuilding, buildTowerParts, buildSkyway, type TowerPart, type PartKind } from './BuildingFactory';
import { buildingVertexShader, buildingFragmentShader } from '../shaders/buildingShader';
import { TextureFactory } from '../assets/TextureFactory';
import {
  getCameraCurve,
  distToCameraPathXZ,
  intersectsClearanceTube,
  bankPosition,
  STREET_WIDTH,
  CLEARANCE_RADIUS_CANYON,
} from '../camera/path';

interface Layer {
  kind: PartKind;
  mesh: THREE.InstancedMesh;
  capacity: number;
  count: number;
}

/**
 * Brutalist megacity authored around the camera corridor:
 * clearance tube → left/right banks → hero framing towers → skyways above.
 * Composition > density spam.
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
  private textures = TextureFactory.getCityTextures();

  constructor(buildingCount: number, seed = 0xfc17) {
    // Prefer readable composition — cap density spam
    const target = Math.min(buildingCount, Math.max(420, Math.floor(buildingCount * 0.72)));
    this.count = target;
    const rng = new RNG(seed);

    const tex = this.textures;
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
        uFogDensity: { value: 0.0012 },
        uFogColor: { value: new THREE.Color(0x060a14) },
        uCameraPos: { value: new THREE.Vector3() },
        uCorePos: { value: this.corePos.clone() },
        uCyan: { value: new THREE.Color(0x4de8ff) },
        uMagenta: { value: new THREE.Color(0xff3d9a) },
        uConcreteMap: { value: tex.concrete },
        uRoughnessMap: { value: tex.roughness },
        uWindowMap: { value: tex.windows },
        uMetalMap: { value: tex.metal },
        uUseTextures: { value: 1 },
      },
    });

    const volCap = Math.ceil(target * 5.5);
    const detCap = Math.ceil(target * 1.8);
    const bridgeCap = 160;
    const stripCap = 160;

    this.layers = {
      volume: this.makeLayer('volume', volCap),
      detail: this.makeLayer('detail', detCap),
      bridge: this.makeLayer('bridge', bridgeCap),
      strip: this.makeLayer('strip', stripCap),
    };

    this.addTerrain(rng);
    this.placeBankedCity(rng, target);
    this.placeHeroMegatowers(rng);
    this.placeSkyways(rng);
    this.horizon = this.placeHorizon(rng);

    for (const layer of Object.values(this.layers)) {
      layer.mesh.count = layer.count;
      layer.mesh.instanceMatrix.needsUpdate = true;
      const colorAttr = layer.mesh.geometry.getAttribute('instanceColorAttr') as THREE.InstancedBufferAttribute;
      const seedAttr = layer.mesh.geometry.getAttribute('instanceSeed') as THREE.InstancedBufferAttribute;
      const emissiveAttr = layer.mesh.geometry.getAttribute('instanceEmissive') as THREE.InstancedBufferAttribute;
      colorAttr.needsUpdate = true;
      seedAttr.needsUpdate = true;
      emissiveAttr.needsUpdate = true;
      this.group.add(layer.mesh);
    }
    this.group.add(this.horizon);
  }

  private makeLayer(kind: PartKind, capacity: number): Layer {
    const geo = new THREE.BoxGeometry(1, 1, 1);
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
    return `${Math.round(x / 14)}_${Math.round(z / 14)}`;
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
    // Reject volumes that would sit inside the clearance tube
    if (p.kind === 'volume' || p.kind === 'detail') {
      const half = Math.max(p.sx, p.sz) * 0.5;
      if (intersectsClearanceTube(p.x, p.z, half)) return false;
    }
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
    const asphalt = this.textures.asphalt;
    const groundMat = new THREE.MeshStandardMaterial({
      map: asphalt,
      color: 0xffffff,
      roughness: 0.55,
      metalness: 0.25,
      emissive: 0x0a1525,
      emissiveIntensity: 0.18,
      envMapIntensity: 0.4,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.15;
    this.group.add(ground);

    // Central avenue wet plate (slightly raised reflective strip)
    const avenueMat = new THREE.MeshStandardMaterial({
      map: asphalt,
      color: 0xc8d0dc,
      roughness: 0.35,
      metalness: 0.45,
      emissive: 0x102030,
      emissiveIntensity: 0.28,
    });
    // Stretch UV along avenue
    const avenueGeo = new THREE.PlaneGeometry(STREET_WIDTH, 900, 1, 1);
    // Remap UVs so lane marks run along +Z
    const uv = avenueGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i);
      const v = uv.getY(i);
      uv.setXY(i, v * 8, u);
    }
    uv.needsUpdate = true;
    const avenue = new THREE.Mesh(avenueGeo, avenueMat);
    avenue.rotation.x = -Math.PI / 2;
    avenue.position.set(0, 0.05, 80);
    this.group.add(avenue);

    // Sidewalk curbs along avenue
    const curbMat = new THREE.MeshStandardMaterial({
      map: this.textures.concrete,
      color: 0x8899aa,
      roughness: 0.85,
      metalness: 0.1,
      emissive: 0x081018,
      emissiveIntensity: 0.1,
    });
    for (const side of [-1, 1]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 880), curbMat);
      curb.position.set(side * (STREET_WIDTH * 0.5 + 1.1), 0.25, 60);
      this.group.add(curb);
    }

    // Occasional plaza pads OUTSIDE clearance
    for (let i = 0; i < 14; i++) {
      const x = rng.range(-300, 300);
      const z = rng.range(-220, 400);
      if (intersectsClearanceTube(x, z, 20)) continue;
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(rng.range(18, 48), 1.1, rng.range(18, 48)),
        curbMat
      );
      pad.position.set(x, 0.4, z);
      this.group.add(pad);
    }
  }

  /**
   * Primary placement: sample camera path, plant towers on LEFT/RIGHT banks
   * like a canyon / boulevard. Fills depth behind banks with mid-density.
   */
  private placeBankedCity(rng: RNG, buildingCount: number): void {
    const curve = getCameraCurve();
    let placed = 0;
    const bankOut = new THREE.Vector3();

    // Dense samples along path for bank rows
    const samples = 48;
    for (let i = 0; i < samples && placed < buildingCount; i++) {
      const t = i / (samples - 1);
      // Skip finale pullback samples (high Z far back already covered by intro banks)
      const p = curve.getPoint(t);
      if (p.z > 700 || p.z < -140) continue;

      for (const side of [-1, 1] as const) {
        // Multiple depth rows per side
        const rows = side === -1 ? [1, 2, 3, 4] : [1, 2, 3, 4];
        for (const row of rows) {
          if (placed >= buildingCount) break;
          const lateral =
            CLEARANCE_RADIUS_CANYON + 8 + row * rng.range(16, 24) + rng.range(-3, 3);
          bankPosition(t, side, lateral, bankOut);
          let x = bankOut.x + rng.range(-4, 4);
          let z = bankOut.z + rng.range(-6, 6);

          const halfEst = row === 1 ? 14 : 10;
          if (intersectsClearanceTube(x, z, halfEst)) continue;
          if (!this.tryOccupy(x, z)) continue;

          // Front row = hero taller silhouettes; back = midrise density
          let family: 'megatower' | 'vertical' | 'midrise' | 'industrial';
          let hScale = 1;
          if (row === 1) {
            family = rng.chance(0.55) ? 'megatower' : 'vertical';
            hScale = rng.range(1.15, 1.65);
          } else if (row === 2) {
            family = rng.chance(0.4) ? 'vertical' : 'midrise';
            hScale = rng.range(0.95, 1.25);
          } else if (row === 3) {
            family = rng.chance(0.3) ? 'industrial' : 'midrise';
            hScale = rng.range(0.75, 1.1);
          } else {
            family = rng.pick(['midrise', 'industrial', 'vertical'] as const);
            hScale = rng.range(0.7, 1.05);
          }

          const spec = rollBuilding(family, rng);
          spec.height *= hScale;
          // Face the avenue slightly
          const yaw = Math.atan2(-x, 0.001) * 0.15 + rng.range(-0.08, 0.08);
          const parts = buildTowerParts(family, spec, x, z, yaw, rng);
          let any = false;
          for (const part of parts) {
            if (this.addPart(part)) any = true;
          }
          if (any) placed++;
        }
      }
    }

    // Secondary fill — districts away from corridor (still clearance-checked)
    const fillers: DistrictDef[] = [
      {
        id: 'industrial_canyon',
        label: 'Industrial West',
        cx: -200,
        cz: 80,
        radius: 110,
        density: 1,
        families: ['industrial', 'midrise', 'transit'],
        weights: [0.55, 0.3, 0.15],
        heightScale: 0.8,
      },
      {
        id: 'vertical_slums',
        label: 'Vertical East',
        cx: 200,
        cz: 40,
        radius: 100,
        density: 1,
        families: ['vertical', 'midrise', 'anomaly'],
        weights: [0.5, 0.35, 0.15],
        heightScale: 1.1,
      },
      {
        id: 'fracture_zone',
        label: 'Far South',
        cx: -40,
        cz: -180,
        radius: 90,
        density: 0.7,
        families: ['anomaly', 'megatower', 'vertical'],
        weights: [0.4, 0.35, 0.25],
        heightScale: 1.2,
      },
      {
        id: 'skyway_network',
        label: 'North approach fill',
        cx: 0,
        cz: 320,
        radius: 120,
        density: 0.6,
        families: ['midrise', 'megatower', 'transit'],
        weights: [0.45, 0.3, 0.25],
        heightScale: 1.0,
      },
    ];

    for (const district of fillers) {
      const n = Math.floor(district.density * 55);
      for (let k = 0; k < n && placed < buildingCount; k++) {
        const ang = rng.next() * Math.PI * 2;
        const rad = Math.pow(rng.next(), 0.6) * district.radius;
        let x = district.cx + Math.cos(ang) * rad;
        let z = district.cz + Math.sin(ang) * rad;
        x += rng.range(-4, 4);
        z += rng.range(-4, 4);

        if (intersectsClearanceTube(x, z, 12)) continue;
        if (!this.tryOccupy(x, z)) continue;

        const family = pickFamily(district, rng.next());
        const spec = rollBuilding(family, rng);
        spec.height *= district.heightScale * rng.range(0.9, 1.15);
        const parts = buildTowerParts(family, spec, x, z, rng.range(-0.1, 0.1), rng);
        let any = false;
        for (const part of parts) {
          if (this.addPart(part)) any = true;
        }
        if (any) placed++;
      }
    }

    // Soft fill remainder far from path
    let guard = 0;
    while (placed < buildingCount && guard++ < buildingCount * 4) {
      const x = rng.range(-320, 320);
      const z = rng.range(-240, 480);
      if (intersectsClearanceTube(x, z, 14)) continue;
      if (distToCameraPathXZ(x, z) < 55) continue;
      if (!this.tryOccupy(x, z)) continue;
      const family = rng.pick(['midrise', 'vertical', 'industrial'] as const);
      const spec = rollBuilding(family, rng);
      const parts = buildTowerParts(family, spec, x, z, rng.range(-0.1, 0.1), rng);
      let any = false;
      for (const part of parts) {
        if (this.addPart(part)) any = true;
      }
      if (any) placed++;
    }
  }

  /** Explicit megatowers framing the avenue entrance & canyon. */
  private placeHeroMegatowers(rng: RNG): void {
    // [side, pathT, lateral, heightScale]
    const anchors: Array<[-1 | 1, number, number, number]> = [
      // Entrance gate (high Z)
      [-1, 0.12, 48, 1.85],
      [1, 0.12, 52, 1.95],
      [-1, 0.18, 46, 1.7],
      [1, 0.18, 50, 1.75],
      // Mid canyon framing
      [-1, 0.28, 44, 1.55],
      [1, 0.28, 48, 1.6],
      [-1, 0.35, 46, 1.5],
      [1, 0.35, 44, 1.55],
      // Near core
      [-1, 0.48, 48, 1.4],
      [1, 0.48, 50, 1.45],
      [-1, 0.55, 52, 1.35],
      [1, 0.55, 48, 1.3],
    ];

    const pos = new THREE.Vector3();
    for (const [side, t, lateral, hScale] of anchors) {
      bankPosition(t, side, lateral, pos);
      const x = pos.x + rng.range(-2, 2);
      const z = pos.z + rng.range(-3, 3);
      if (intersectsClearanceTube(x, z, 16)) continue;
      this.tryOccupy(x, z);
      const family = rng.chance(0.75) ? 'megatower' : 'vertical';
      const spec = rollBuilding(family, rng);
      spec.height *= hScale;
      const yaw = rng.range(-0.04, 0.04);
      const parts = buildTowerParts(family, spec, x, z, yaw, rng);
      for (const p of parts) this.addPart(p);
    }
  }

  private placeSkyways(rng: RNG): void {
    // Cross-avenue skyways — camera flies UNDER these (y well above canyon cam ~36)
    const crossZs = [240, 190, 140, 95, 50, 10, -40];
    const crossYs = [58, 72, 88, 105, 64, 92, 78];
    for (let i = 0; i < crossZs.length; i++) {
      const z = crossZs[i] + rng.range(-4, 4);
      const y = crossYs[i];
      // Span across avenue; pylons land on banks outside clearance
      const x1 = -95 - rng.range(0, 20);
      const x2 = 95 + rng.range(0, 20);
      const parts = buildSkyway(x1, z, x2, z + rng.range(-8, 8), y, rng);
      for (const p of parts) {
        // Allow bridges over corridor; skip pylons/details inside tube at low Y
        if (p.kind === 'bridge' || p.kind === 'strip') {
          this.addPartUnchecked(p);
        } else if (!intersectsClearanceTube(p.x, p.z, Math.max(p.sx, p.sz) * 0.5)) {
          this.addPart(p);
        }
      }
    }

    // Secondary elevated decks parallel / diagonal — keep clear of low camera tube
    for (let i = 0; i < 28; i++) {
      const y = rng.pick([70, 95, 120, 150]) + rng.range(-4, 4);
      const x1 = rng.range(-240, 240);
      const z1 = rng.range(-160, 380);
      const len = rng.range(60, 160);
      const ang = rng.pick([0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]);
      const x2 = x1 + Math.sin(ang) * len;
      const z2 = z1 + Math.cos(ang) * len;
      // If mid-span is over corridor, require high enough clearance
      const mx = (x1 + x2) * 0.5;
      const mz = (z1 + z2) * 0.5;
      if (distToCameraPathXZ(mx, mz) < CLEARANCE_RADIUS_CANYON && y < 55) continue;
      const parts = buildSkyway(x1, z1, x2, z2, y, rng);
      for (const p of parts) {
        if (p.kind === 'bridge' || p.kind === 'strip') {
          if (y >= 55 || !intersectsClearanceTube(p.x, p.z, 4)) this.addPartUnchecked(p);
        } else if (!intersectsClearanceTube(p.x, p.z, Math.max(p.sx, p.sz) * 0.5)) {
          this.addPart(p);
        }
      }
    }
  }

  /** Add part without clearance reject (bridges over corridor). */
  private addPartUnchecked(p: TowerPart): boolean {
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

  private placeHorizon(rng: RNG): THREE.InstancedMesh {
    const count = 64;
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
      const r = rng.range(520, 780);
      const h = rng.range(160, 440);
      const w = rng.range(30, 95);
      const d = rng.range(30, 95);
      this.dummy.position.set(Math.cos(ang) * r, h * 0.5, Math.sin(ang) * r);
      this.dummy.scale.set(w, h, d);
      this.dummy.rotation.set(0, ang + Math.PI / 2, 0);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(i, this.dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    const midCount = 36;
    const mid = new THREE.InstancedMesh(geo, mat.clone(), midCount);
    mid.frustumCulled = false;
    for (let i = 0; i < midCount; i++) {
      const ang = rng.next() * Math.PI * 2;
      const r = rng.range(360, 500);
      const h = rng.range(110, 300);
      const x = Math.cos(ang) * r;
      const z = Math.sin(ang) * r;
      if (intersectsClearanceTube(x, z, 30)) continue;
      this.dummy.position.set(x, h * 0.5, z);
      this.dummy.scale.set(rng.range(18, 55), h, rng.range(18, 55));
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
    u.uFogDensity.value = 0.00115 + knobs.fracture * 0.0005 + knobs.ghost * 0.0003;
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
