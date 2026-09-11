import * as THREE from 'three';
import { RNG } from '../utils/rng';
import { DISTRICTS, pickFamily } from './DistrictManager';
import { rollBuilding } from './BuildingFactory';
import { buildingVertexShader, buildingFragmentShader } from '../shaders/buildingShader';

export class CityGenerator {
  readonly group = new THREE.Group();
  readonly mesh: THREE.InstancedMesh;
  readonly material: THREE.ShaderMaterial;
  readonly count: number;
  private dummy = new THREE.Object3D();
  private corePos = new THREE.Vector3(0, 50, 0);

  constructor(buildingCount: number, seed = 0xfc17) {
    this.count = buildingCount;
    const rng = new RNG(seed);
    const geo = new THREE.BoxGeometry(1, 1, 1);
    // Add a few silhouette variants as separate geoms merged via scale only

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
        uFogDensity: { value: 0.0016 },
        uFogColor: { value: new THREE.Color(0x070b16) },
        uCameraPos: { value: new THREE.Vector3() },
        uCorePos: { value: this.corePos.clone() },
        uCyan: { value: new THREE.Color(0x4de8ff) },
        uMagenta: { value: new THREE.Color(0xff3d9a) },
      },
    });

    this.mesh = new THREE.InstancedMesh(geo, this.material, buildingCount);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;

    const colorAttr = new Float32Array(buildingCount * 3);
    const seedAttr = new Float32Array(buildingCount);
    const emissiveAttr = new Float32Array(buildingCount);

    let i = 0;
    // Ground plane / streets cue
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900),
      new THREE.MeshStandardMaterial({
        color: 0x05070e,
        roughness: 1,
        metalness: 0,
        emissive: 0x0a1525,
        emissiveIntensity: 0.15,
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    this.group.add(ground);

    // Street grid lines (subtle)
    const gridMat = new THREE.LineBasicMaterial({ color: 0x1a3048, transparent: true, opacity: 0.35 });
    for (let g = -8; g <= 8; g++) {
      const ptsA = [new THREE.Vector3(g * 40, 0.3, -320), new THREE.Vector3(g * 40, 0.3, 320)];
      const ptsB = [new THREE.Vector3(-320, 0.3, g * 40), new THREE.Vector3(320, 0.3, g * 40)];
      this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ptsA), gridMat));
      this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ptsB), gridMat));
    }

    // Allocate per district proportional to density
    const densSum = DISTRICTS.reduce((a, d) => a + d.density, 0);

    for (const district of DISTRICTS) {
      const n = Math.floor((district.density / densSum) * buildingCount);
      for (let k = 0; k < n && i < buildingCount; k++, i++) {
        const ang = rng.next() * Math.PI * 2;
        const rad = Math.sqrt(rng.next()) * district.radius;
        let x = district.cx + Math.cos(ang) * rad;
        let z = district.cz + Math.sin(ang) * rad;
        // Keep street gutters clear-ish
        x = Math.round(x / 14) * 14 + rng.range(-2, 2);
        z = Math.round(z / 14) * 14 + rng.range(-2, 2);

        const family = pickFamily(district, rng.next());
        const spec = rollBuilding(family, rng);
        const h = spec.height * district.heightScale * rng.range(0.85, 1.15);

        this.dummy.position.set(x, h * 0.5, z);
        this.dummy.scale.set(spec.width, h, spec.depth);
        // Slight yaw variety
        this.dummy.rotation.set(0, rng.range(-0.08, 0.08), 0);
        // Anomaly tilt baked into base for drama
        if (family === 'anomaly') {
          this.dummy.rotation.z = rng.range(-0.15, 0.15);
          this.dummy.rotation.x = rng.range(-0.1, 0.1);
        }
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this.dummy.matrix);

        colorAttr[i * 3] = spec.color.r;
        colorAttr[i * 3 + 1] = spec.color.g;
        colorAttr[i * 3 + 2] = spec.color.b;
        seedAttr[i] = spec.seed;
        emissiveAttr[i] = spec.emissive;
      }
    }

    // Fill remainder with midrise scatter
    while (i < buildingCount) {
      const x = rng.range(-280, 280);
      const z = rng.range(-280, 280);
      const spec = rollBuilding('midrise', rng);
      this.dummy.position.set(x, spec.height * 0.5, z);
      this.dummy.scale.set(spec.width, spec.height, spec.depth);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      colorAttr[i * 3] = spec.color.r;
      colorAttr[i * 3 + 1] = spec.color.g;
      colorAttr[i * 3 + 2] = spec.color.b;
      seedAttr[i] = spec.seed;
      emissiveAttr[i] = spec.emissive;
      i++;
    }

    this.mesh.geometry.setAttribute('instanceColorAttr', new THREE.InstancedBufferAttribute(colorAttr, 3));
    this.mesh.geometry.setAttribute('instanceSeed', new THREE.InstancedBufferAttribute(seedAttr, 1));
    this.mesh.geometry.setAttribute('instanceEmissive', new THREE.InstancedBufferAttribute(emissiveAttr, 1));
    this.mesh.instanceMatrix.needsUpdate = true;

    this.group.add(this.mesh);

    // Skyway bridges
    this.addSkyways(rng);
    // Distant skyline cards for depth
    this.addHorizonSilhouettes(rng);
  }

  private addSkyways(rng: RNG): void {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x101820,
      emissive: 0x4de8ff,
      emissiveIntensity: 0.15,
      roughness: 0.8,
      metalness: 0.4,
    });
    for (let i = 0; i < 28; i++) {
      const len = rng.range(40, 140);
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(len, 1.2, 4), mat);
      bridge.position.set(rng.range(-200, 200), rng.range(35, 120), rng.range(-200, 200));
      bridge.rotation.y = rng.range(0, Math.PI);
      this.group.add(bridge);
    }
  }

  private addHorizonSilhouettes(rng: RNG): void {
    const mat = new THREE.MeshBasicMaterial({ color: 0x050810, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 40; i++) {
      const h = rng.range(80, 260);
      const m = new THREE.Mesh(new THREE.BoxGeometry(rng.range(12, 40), h, rng.range(12, 40)), mat);
      const ang = rng.next() * Math.PI * 2;
      const r = rng.range(380, 520);
      m.position.set(Math.cos(ang) * r, h * 0.5, Math.sin(ang) * r);
      this.group.add(m);
    }
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
  }

  setVisible(v: boolean): void {
    this.group.visible = v;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
