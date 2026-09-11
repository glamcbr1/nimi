import * as THREE from 'three';

/**
 * Gravity failure: towers tilting as blocks, districts lifting — HUGE & readable.
 * Prefer impactful few over thousands of tiny boxes.
 */
export class GravitySystem {
  readonly group = new THREE.Group();
  private chunks: THREE.Mesh[] = [];
  private base: Array<{ x: number; y: number; z: number; rx: number; ry: number; rz: number; tilt: number }> =
    [];
  private strength = 0;

  constructor() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0c121a,
      emissive: 0x1a3048,
      emissiveIntensity: 0.14,
      roughness: 0.88,
      metalness: 0.25,
    });
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0x0a1018,
      emissive: 0x4de8ff,
      emissiveIntensity: 0.3,
      roughness: 0.7,
      metalness: 0.35,
    });
    const magMat = new THREE.MeshStandardMaterial({
      color: 0x100818,
      emissive: 0xff3d9a,
      emissiveIntensity: 0.28,
      roughness: 0.75,
      metalness: 0.35,
    });

    // Hero district slabs — fewer, bigger (tilting tower blocks)
    for (let i = 0; i < 48; i++) {
      const mega = i < 12;
      const w = mega ? 14 + Math.random() * 28 : 5 + Math.random() * 16;
      const h = mega ? 40 + Math.random() * 90 : 8 + Math.random() * 35;
      const d = mega ? 14 + Math.random() * 28 : 5 + Math.random() * 14;
      const pick = Math.random();
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        pick > 0.82 ? magMat : pick > 0.55 ? glowMat : mat
      );
      // Keep mostly off corridor center
      const side = Math.random() > 0.5 ? 1 : -1;
      const x = side * (50 + Math.random() * 200);
      const y = mega ? h * 0.35 : 10 + Math.random() * 100;
      const z = -80 + Math.random() * 320;
      m.position.set(x, y, z);
      m.rotation.set(Math.random() * 0.15, Math.random() * Math.PI, Math.random() * 0.15);
      this.base.push({
        x,
        y,
        z,
        rx: m.rotation.x,
        ry: m.rotation.y,
        rz: m.rotation.z,
        tilt: (Math.random() - 0.5) * 0.9,
      });
      this.chunks.push(m);
      this.group.add(m);
    }

    // Smaller debris field around them
    for (let i = 0; i < 40; i++) {
      const w = 2 + Math.random() * 8;
      const h = 2 + Math.random() * 12;
      const d = 2 + Math.random() * 8;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), Math.random() > 0.6 ? glowMat : mat);
      const x = (Math.random() - 0.5) * 300;
      const y = 15 + Math.random() * 140;
      const z = (Math.random() - 0.5) * 300;
      m.position.set(x, y, z);
      m.rotation.set(Math.random(), Math.random(), Math.random());
      this.base.push({
        x,
        y,
        z,
        rx: m.rotation.x,
        ry: m.rotation.y,
        rz: m.rotation.z,
        tilt: (Math.random() - 0.5) * 1.2,
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
      const lift = s * (40 + (i % 9) * 16);
      const drift = s * 22;
      c.position.x = b.x + Math.sin(time * 0.2 + i * 0.4) * drift;
      c.position.y = b.y + lift * (0.55 + 0.45 * Math.sin(time * 0.28 + i));
      c.position.z = b.z + Math.cos(time * 0.18 + i * 0.3) * drift;
      // Towers tilting as blocks — readable, not spin soup
      c.rotation.x = b.rx + b.tilt * s * 0.85 + time * 0.08 * s * ((i % 3) - 1) * 0.3;
      c.rotation.y = b.ry + time * 0.06 * s;
      c.rotation.z = b.rz + b.tilt * s * 1.1 + time * 0.05 * s * ((i % 5) - 2) * 0.2;
    }
  }

  dispose(): void {
    for (const c of this.chunks) {
      c.geometry.dispose();
      (c.material as THREE.Material).dispose();
    }
  }
}
