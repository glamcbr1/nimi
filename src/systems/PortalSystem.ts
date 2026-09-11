import * as THREE from 'three';

/** Dimensional ghost portals / spatial tears — larger, more readable */
export class PortalSystem {
  readonly group = new THREE.Group();
  private portals: THREE.Mesh[] = [];
  private ghosts: THREE.Mesh[] = [];
  private strength = 0;

  constructor() {
    for (let i = 0; i < 10; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0x4de8ff : 0xff3d9a,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const p = new THREE.Mesh(new THREE.RingGeometry(8, 14, 64), mat);
      p.position.set(
        (Math.random() - 0.5) * 200,
        25 + Math.random() * 100,
        (Math.random() - 0.5) * 200
      );
      p.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      this.portals.push(p);
      this.group.add(p);

      // Ghost tower silhouette inside tear
      const ghost = new THREE.Mesh(
        new THREE.BoxGeometry(5, 22 + Math.random() * 20, 5),
        new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0x66e8ff : 0xff66b0,
          transparent: true,
          opacity: 0.12,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      ghost.position.copy(p.position);
      this.ghosts.push(ghost);
      this.group.add(ghost);
    }
    this.group.visible = false;
  }

  setStrength(s: number): void {
    this.strength = s;
    this.group.visible = s > 0.02;
  }

  update(time: number): void {
    if (this.strength < 0.02) return;
    for (let i = 0; i < this.portals.length; i++) {
      const p = this.portals[i];
      p.rotation.z = time * (0.18 + i * 0.04);
      const s = this.strength * (1 + Math.sin(time * 1.8 + i) * 0.2);
      p.scale.setScalar(0.6 + s * 1.1);
      (p.material as THREE.MeshBasicMaterial).opacity = 0.12 + this.strength * 0.45;
      const g = this.ghosts[i];
      g.position.y = p.position.y + Math.sin(time + i) * 4 * this.strength;
      g.rotation.y = time * 0.3;
      (g.material as THREE.MeshBasicMaterial).opacity = 0.08 + this.strength * 0.22;
    }
  }

  dispose(): void {
    for (const p of this.portals) {
      p.geometry.dispose();
      (p.material as THREE.Material).dispose();
    }
    for (const g of this.ghosts) {
      g.geometry.dispose();
      (g.material as THREE.Material).dispose();
    }
  }
}
