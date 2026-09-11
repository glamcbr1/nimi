import * as THREE from 'three';
import { RNG } from '../utils/rng';

interface Vehicle {
  curve: THREE.CatmullRomCurve3;
  t: number;
  speed: number;
  color: THREE.Color;
}

/** Aerial + avenue traffic as light streaks — support act, not the main show. */
export class TrafficSystem {
  readonly group = new THREE.Group();
  private vehicles: Vehicle[] = [];
  private mesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private glitch = 0;

  constructor(count: number, seed = 99) {
    const rng = new RNG(seed);
    const geo = new THREE.BoxGeometry(3.2, 0.35, 0.45);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);

    const avenueCount = Math.floor(count * 0.35);
    for (let i = 0; i < count; i++) {
      let curve: THREE.CatmullRomCurve3;
      if (i < avenueCount) {
        // Street-level / low skyway along the central avenue (+Z corridor)
        const lane = ((i % 4) - 1.5) * 7;
        const y = rng.pick([3.5, 4.2, 22, 28, 42]);
        const z0 = rng.range(-80, 120);
        const pts: THREE.Vector3[] = [];
        for (let s = 0; s <= 8; s++) {
          pts.push(
            new THREE.Vector3(
              lane + rng.range(-1.5, 1.5),
              y + Math.sin(s * 0.7 + i) * 0.4,
              z0 + s * 55 + rng.range(-3, 3)
            )
          );
        }
        curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.25);
      } else {
        const y = rng.pick([58, 78, 98, 125, 155, 180]);
        const radius = rng.range(70, 280);
        const cx = rng.range(-140, 140);
        const cz = rng.range(-60, 220);
        const pts: THREE.Vector3[] = [];
        const segs = 10;
        const elliptical = rng.chance(0.4);
        for (let s = 0; s <= segs; s++) {
          const a = (s / segs) * Math.PI * 2;
          const rx = elliptical ? radius * rng.range(0.6, 1.0) : radius;
          const rz = elliptical ? radius : radius * rng.range(0.7, 1.1);
          pts.push(
            new THREE.Vector3(
              cx + Math.cos(a) * rx + rng.range(-6, 6),
              y + Math.sin(a * 2) * 3,
              cz + Math.sin(a) * rz + rng.range(-6, 6)
            )
          );
        }
        curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.3);
      }

      const warm = rng.chance(0.45);
      const color = new THREE.Color().setHSL(warm ? 0.08 : 0.55, 0.85, 0.55);
      this.vehicles.push({
        curve,
        t: rng.next(),
        speed: rng.range(0.025, 0.09),
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
      let spd = v.speed * (1 - this.glitch * 0.65);
      if (this.glitch > 0.4 && Math.sin(i * 12.3 + performance.now() * 0.01) > 0.7) {
        spd *= -0.45;
      }
      v.t = (v.t + dt * spd) % 1;
      if (v.t < 0) v.t += 1;
      const p = v.curve.getPointAt(v.t);
      const p2 = v.curve.getPointAt(Math.min(0.999, (v.t + 0.008) % 1));
      this.dummy.position.copy(p);
      const stretch = 1.2 + this.glitch * (i % 3 === 0 ? 2.5 : 0.5);
      this.dummy.scale.set(stretch, 1, 1);
      this.dummy.lookAt(p2);
      if (this.glitch > 0.5) {
        this.dummy.position.y += Math.sin(performance.now() * 0.01 + i) * this.glitch * 10;
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
