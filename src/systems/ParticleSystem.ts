import * as THREE from 'three';

/** Debris / fracture energy particles pulled toward core */
export class ParticleSystem {
  readonly group = new THREE.Group();
  private points: THREE.Points;
  private pos: Float32Array;
  private vel: Float32Array;
  private count: number;
  private strength = 0;

  constructor(count = 1200) {
    this.count = count;
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.respawn(i, true);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xff3d9a,
      size: 1.2,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.group.add(this.points);
    this.group.visible = false;
  }

  private respawn(i: number, init = false): void {
    const r = 30 + Math.random() * 180;
    const a = Math.random() * Math.PI * 2;
    const y = Math.random() * 160;
    this.pos[i * 3] = Math.cos(a) * r;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = Math.sin(a) * r;
    this.vel[i * 3] = (Math.random() - 0.5) * 10;
    this.vel[i * 3 + 1] = (Math.random() - 0.5) * 10;
    this.vel[i * 3 + 2] = (Math.random() - 0.5) * 10;
    if (!init) {
      // toward core swirl
    }
  }

  setStrength(s: number): void {
    this.strength = s;
    this.group.visible = s > 0.02;
    (this.points.material as THREE.PointsMaterial).opacity = Math.min(1, s * 1.2);
    (this.points.material as THREE.PointsMaterial).color.set(
      s > 0.6 ? 0xff2a4a : 0xff3d9a
    );
  }

  update(dt: number, core: THREE.Vector3): void {
    if (this.strength < 0.02) return;
    for (let i = 0; i < this.count; i++) {
      const ix = i * 3;
      const dx = core.x - this.pos[ix];
      const dy = core.y - this.pos[ix + 1];
      const dz = core.z - this.pos[ix + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01;
      this.vel[ix] += (dx / d) * this.strength * 40 * dt;
      this.vel[ix + 1] += (dy / d) * this.strength * 40 * dt;
      this.vel[ix + 2] += (dz / d) * this.strength * 40 * dt;
      // swirl
      this.vel[ix] += (-dz / d) * this.strength * 12 * dt;
      this.vel[ix + 2] += (dx / d) * this.strength * 12 * dt;

      this.pos[ix] += this.vel[ix] * dt;
      this.pos[ix + 1] += this.vel[ix + 1] * dt;
      this.pos[ix + 2] += this.vel[ix + 2] * dt;

      if (d < 8 || d > 260) this.respawn(i);
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
