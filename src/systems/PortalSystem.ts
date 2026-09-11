import * as THREE from 'three';

/** Dimensional ghost portals / spatial tears */
export class PortalSystem {
  readonly group = new THREE.Group();
  private portals: THREE.Mesh[] = [];
  private strength = 0;

  constructor() {
    for (let i = 0; i < 8; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0x4de8ff : 0xff3d9a,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const p = new THREE.Mesh(new THREE.RingGeometry(6, 10, 48), mat);
      p.position.set(
        (Math.random() - 0.5) * 160,
        20 + Math.random() * 80,
        (Math.random() - 0.5) * 160
      );
      p.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      this.portals.push(p);
      this.group.add(p);

      // Ghost building silhouette inside
      const ghost = new THREE.Mesh(
        new THREE.BoxGeometry(4, 16, 4),
        new THREE.MeshBasicMaterial({
          color: 0x88e0ff,
          transparent: true,
          opacity: 0.15,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      ghost.position.copy(p.position);
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
      p.rotation.z = time * (0.2 + i * 0.05);
      const s = this.strength * (1 + Math.sin(time * 2 + i) * 0.15);
      p.scale.setScalar(s);
      (p.material as THREE.MeshBasicMaterial).opacity = 0.15 + this.strength * 0.4;
    }
  }

  dispose(): void {
    for (const p of this.portals) {
      p.geometry.dispose();
      (p.material as THREE.Material).dispose();
    }
  }
}
