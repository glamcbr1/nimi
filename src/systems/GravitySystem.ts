import * as THREE from 'three';

/** Floating debris chunks that reverse gravity during failure */
export class GravitySystem {
  readonly group = new THREE.Group();
  private chunks: THREE.Mesh[] = [];
  private strength = 0;
  private baseY: number[] = [];

  constructor() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x121820,
      emissive: 0x4de8ff,
      emissiveIntensity: 0.08,
      roughness: 0.9,
      metalness: 0.2,
    });
    for (let i = 0; i < 60; i++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(
          2 + Math.random() * 8,
          2 + Math.random() * 6,
          2 + Math.random() * 8
        ),
        mat
      );
      m.position.set(
        (Math.random() - 0.5) * 200,
        10 + Math.random() * 80,
        (Math.random() - 0.5) * 200
      );
      m.rotation.set(Math.random(), Math.random(), Math.random());
      this.baseY.push(m.position.y);
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
    for (let i = 0; i < this.chunks.length; i++) {
      const c = this.chunks[i];
      c.position.y = this.baseY[i] + this.strength * (20 + (i % 7) * 8) * Math.sin(time * 0.4 + i);
      c.rotation.x += 0.01 * this.strength;
      c.rotation.z += 0.008 * this.strength;
    }
  }

  dispose(): void {
    for (const c of this.chunks) {
      c.geometry.dispose();
      (c.material as THREE.Material).dispose();
    }
  }
}
