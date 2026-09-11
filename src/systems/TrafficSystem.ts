import * as THREE from 'three';
import { RNG } from '../utils/rng';

interface Vehicle {
  curve: THREE.CatmullRomCurve3;
  t: number;
  speed: number;
  color: THREE.Color;
}

export class TrafficSystem {
  readonly group = new THREE.Group();
  private vehicles: Vehicle[] = [];
  private mesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private glitch = 0;

  constructor(count: number, seed = 99) {
    const rng = new RNG(seed);
    const geo = new THREE.BoxGeometry(1.6, 0.6, 0.8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);

    for (let i = 0; i < count; i++) {
      const y = rng.pick([4, 8, 18, 36, 55, 78]);
      const radius = rng.range(40, 220);
      const cx = rng.range(-80, 80);
      const cz = rng.range(-80, 80);
      const pts: THREE.Vector3[] = [];
      const segs = 8;
      for (let s = 0; s <= segs; s++) {
        const a = (s / segs) * Math.PI * 2;
        pts.push(
          new THREE.Vector3(
            cx + Math.cos(a) * radius + rng.range(-8, 8),
            y + Math.sin(a * 2) * 2,
            cz + Math.sin(a) * radius + rng.range(-8, 8)
          )
        );
      }
      const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.3);
      const color = new THREE.Color().setHSL(rng.chance(0.5) ? 0.12 : 0.55, 0.9, 0.55);
      this.vehicles.push({
        curve,
        t: rng.next(),
        speed: rng.range(0.02, 0.08),
        color,
      });
      this.mesh.setColorAt(i, color);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  setGlitch(g: number): void {
    this.glitch = g;
  }

  update(dt: number): void {
    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];
      let spd = v.speed * (1 - this.glitch * 0.7);
      if (this.glitch > 0.4 && Math.sin(i * 12.3 + performance.now() * 0.01) > 0.7) {
        spd *= -0.5; // reverse glitch
      }
      v.t = (v.t + dt * spd) % 1;
      if (v.t < 0) v.t += 1;
      const p = v.curve.getPointAt(v.t);
      const p2 = v.curve.getPointAt((v.t + 0.01) % 1);
      this.dummy.position.copy(p);
      this.dummy.scale.setScalar(1 + this.glitch * (i % 3 === 0 ? 2 : 0));
      this.dummy.lookAt(p2);
      if (this.glitch > 0.5) {
        this.dummy.position.y += Math.sin(performance.now() * 0.01 + i) * this.glitch * 8;
      }
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
