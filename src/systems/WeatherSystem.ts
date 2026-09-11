import * as THREE from 'three';

export class WeatherSystem {
  readonly group = new THREE.Group();
  private rain: THREE.Points;
  private velocities: Float32Array;
  private positions: Float32Array;
  private count: number;
  private intensity = 1;

  constructor(count: number) {
    this.count = count;
    this.positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.positions[i * 3] = (Math.random() - 0.5) * 400;
      this.positions[i * 3 + 1] = Math.random() * 300;
      this.positions[i * 3 + 2] = (Math.random() - 0.5) * 400;
      this.velocities[i] = 40 + Math.random() * 80;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xa8c4e0,
      size: 0.45,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.rain = new THREE.Points(geo, mat);
    this.group.add(this.rain);
  }

  setIntensity(v: number): void {
    this.intensity = v;
    (this.rain.material as THREE.PointsMaterial).opacity = 0.45 * v;
    this.rain.visible = v > 0.02;
  }

  update(dt: number, cameraPos: THREE.Vector3): void {
    if (this.intensity < 0.02) return;
    const pos = this.positions;
    for (let i = 0; i < this.count; i++) {
      pos[i * 3 + 1] -= this.velocities[i] * dt * this.intensity;
      pos[i * 3] -= dt * 8 * this.intensity;
      if (pos[i * 3 + 1] < 0) {
        pos[i * 3] = cameraPos.x + (Math.random() - 0.5) * 360;
        pos[i * 3 + 1] = cameraPos.y + 80 + Math.random() * 200;
        pos[i * 3 + 2] = cameraPos.z + (Math.random() - 0.5) * 360;
      }
    }
    (this.rain.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.rain.geometry.dispose();
    (this.rain.material as THREE.Material).dispose();
  }
}
