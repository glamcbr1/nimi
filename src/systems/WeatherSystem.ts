import * as THREE from 'three';

/** Cinematic near-camera rain streaks with wind — longer, denser near field. */
export class WeatherSystem {
  readonly group = new THREE.Group();
  private streaks: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private count: number;
  private intensity = 1;
  private offsets: Float32Array;
  private windPhase = 0;

  constructor(count: number) {
    this.count = Math.min(count, 3200);
    const geo = new THREE.BoxGeometry(0.045, 1, 0.045);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xb8cce0,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.streaks = new THREE.InstancedMesh(geo, mat, this.count);
    this.streaks.frustumCulled = false;
    this.group.add(this.streaks);

    this.offsets = new Float32Array(this.count * 4);
    for (let i = 0; i < this.count; i++) {
      // Bias more streaks near camera (tighter spawn volume)
      const near = i < this.count * 0.55;
      const spread = near ? 55 : 110;
      this.offsets[i * 4] = (Math.random() - 0.5) * spread;
      this.offsets[i * 4 + 1] = Math.random() * 70;
      this.offsets[i * 4 + 2] = (Math.random() - 0.5) * spread;
      this.offsets[i * 4 + 3] = near ? 2.2 + Math.random() * 4.5 : 1.2 + Math.random() * 2.8;
    }
  }

  setIntensity(v: number): void {
    this.intensity = v;
    (this.streaks.material as THREE.MeshBasicMaterial).opacity = 0.2 + 0.32 * v;
    this.streaks.visible = v > 0.02;
  }

  update(dt: number, cameraPos: THREE.Vector3): void {
    if (this.intensity < 0.02) return;
    this.windPhase += dt;
    const windGust = 1 + 0.35 * Math.sin(this.windPhase * 0.7);
    const wind = 14 * this.intensity * windGust;
    const fall = 62 * this.intensity;
    const tilt = -0.28 - 0.12 * windGust * this.intensity;

    for (let i = 0; i < this.count; i++) {
      let x = this.offsets[i * 4];
      let y = this.offsets[i * 4 + 1];
      let z = this.offsets[i * 4 + 2];
      const len = this.offsets[i * 4 + 3];

      y -= fall * dt * (0.85 + (i % 5) * 0.06);
      x -= wind * dt;
      z += Math.sin(this.windPhase + i * 0.01) * 2 * dt;

      if (y < -25) {
        const near = i < this.count * 0.55;
        const spread = near ? 50 : 100;
        x = (Math.random() - 0.5) * spread;
        y = 25 + Math.random() * 65;
        z = (Math.random() - 0.5) * spread;
      }

      this.offsets[i * 4] = x;
      this.offsets[i * 4 + 1] = y;
      this.offsets[i * 4 + 2] = z;

      this.dummy.position.set(cameraPos.x + x, cameraPos.y + y, cameraPos.z + z);
      this.dummy.rotation.set(0, 0, tilt);
      this.dummy.scale.set(1, len * (0.9 + this.intensity * 0.55), 1);
      this.dummy.updateMatrix();
      this.streaks.setMatrixAt(i, this.dummy.matrix);
    }
    this.streaks.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.streaks.geometry.dispose();
    (this.streaks.material as THREE.Material).dispose();
  }
}
