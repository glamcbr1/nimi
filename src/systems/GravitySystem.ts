import * as THREE from 'three';

/** Large-scale floating debris — districts coming apart, readable on scroll */
export class GravitySystem {
  readonly group = new THREE.Group();
  private chunks: THREE.Mesh[] = [];
  private base: Array<{ x: number; y: number; z: number; rx: number; ry: number; rz: number }> = [];
  private strength = 0;

  constructor() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0c121a,
      emissive: 0x1a3048,
      emissiveIntensity: 0.12,
      roughness: 0.88,
      metalness: 0.25,
    });
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0x0a1018,
      emissive: 0x4de8ff,
      emissiveIntensity: 0.25,
      roughness: 0.7,
      metalness: 0.35,
    });

    for (let i = 0; i < 90; i++) {
      const w = 3 + Math.random() * 14;
      const h = 2 + Math.random() * 18;
      const d = 3 + Math.random() * 12;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), Math.random() > 0.7 ? glowMat : mat);
      const x = (Math.random() - 0.5) * 280;
      const y = 8 + Math.random() * 120;
      const z = (Math.random() - 0.5) * 280;
      m.position.set(x, y, z);
      m.rotation.set(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.4);
      this.base.push({
        x,
        y,
        z,
        rx: m.rotation.x,
        ry: m.rotation.y,
        rz: m.rotation.z,
      });
      this.chunks.push(m);
      this.group.add(m);
    }
    this.group.visible = false;
  }

  setStrength(s: number): void {
    this.strength = s;
    this.group.visible = s > 0.02;
  }

  update(time: number): void {
    if (this.strength < 0.02) return;
    const s = this.strength;
    for (let i = 0; i < this.chunks.length; i++) {
      const c = this.chunks[i];
      const b = this.base[i];
      // Large lift — city-scale, not jitter
      const lift = s * (30 + (i % 9) * 12);
      const drift = s * 18;
      c.position.x = b.x + Math.sin(time * 0.25 + i * 0.4) * drift;
      c.position.y = b.y + lift * (0.6 + 0.4 * Math.sin(time * 0.35 + i));
      c.position.z = b.z + Math.cos(time * 0.22 + i * 0.3) * drift;
      c.rotation.x = b.rx + time * 0.15 * s * ((i % 3) - 1);
      c.rotation.y = b.ry + time * 0.12 * s;
      c.rotation.z = b.rz + time * 0.1 * s * ((i % 5) - 2) * 0.3;
    }
  }

  dispose(): void {
    for (const c of this.chunks) {
      c.geometry.dispose();
      (c.material as THREE.Material).dispose();
    }
  }
}
