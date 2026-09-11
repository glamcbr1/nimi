import * as THREE from 'three';

/** Cinematic near-camera rain streaks (not sparse point sprinkle) */
export class WeatherSystem {
  readonly group = new THREE.Group();
  private streaks: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private count: number;
  private intensity = 1;
  private offsets: Float32Array;

  constructor(count: number) {
    // Cap streak meshes for perf; visual density from length + near field
    this.count = Math.min(count, 3500);
    const geo = new THREE.BoxGeometry(0.06, 1, 0.06);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xb0c4d8,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.streaks = new THREE.InstancedMesh(geo, mat, this.count);
    this.streaks.frustumCulled = false;
    this.group.add(this.streaks);

    this.offsets = new Float32Array(this.count * 4);
    for (let i = 0; i < this.count; i++) {
      this.offsets[i * 4] = (Math.random() - 0.5) * 120;
      this.offsets[i * 4 + 1] = Math.random() * 80;
      this.offsets[i * 4 + 2] = (Math.random() - 0.5) * 120;
      this.offsets[i * 4 + 3] = 1.5 + Math.random() * 3.5; // streak length scale
    }
  }

  setIntensity(v: number): void {
    this.intensity = v;
    (this.streaks.material as THREE.MeshBasicMaterial).opacity = 0.22 + 0.28 * v;
    this.streaks.visible = v > 0.02;
  }

  update(dt: number, cameraPos: THREE.Vector3): void {
    if (this.intensity < 0.02) return;
    const wind = 12 * this.intensity;
    const fall = 55 * this.intensity;
    for (let i = 0; i < this.count; i++) {
      let x = this.offsets[i * 4];
      let y = this.offsets[i * 4 + 1];
      let z = this.offsets[i * 4 + 2];
      const len = this.offsets[i * 4 + 3];

      y -= fall * dt;
      x -= wind * dt;

      if (y < -20) {
        x = (Math.random() - 0.5) * 100;
        y = 30 + Math.random() * 70;
        z = (Math.random() - 0.5) * 100;
      }

      this.offsets[i * 4] = x;
      this.offsets[i * 4 + 1] = y;
      this.offsets[i * 4 + 2] = z;

      this.dummy.position.set(cameraPos.x + x, cameraPos.y + y, cameraPos.z + z);
      // Tilt with wind
      this.dummy.rotation.set(0, 0, -0.35);
      this.dummy.scale.set(1, len * (0.8 + this.intensity * 0.5), 1);
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
