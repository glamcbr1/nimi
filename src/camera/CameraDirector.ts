import * as THREE from 'three';
import { clamp, lerp } from '../utils/math';

export class CameraDirector {
  readonly camera: THREE.PerspectiveCamera;
  private path: THREE.CatmullRomCurve3;
  private lookPath: THREE.CatmullRomCurve3;
  private mouse = new THREE.Vector2(0, 0);
  private mouseSmooth = new THREE.Vector2(0, 0);
  private tmp = new THREE.Vector3();
  private tmpLook = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  constructor() {
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.5, 2500);
    this.camera.position.set(0, 180, 420);

    // Cinematic spline: distant skyline → canyon immersion → fracture ascent → core → void → space
    const pts = [
      new THREE.Vector3(0, 220, 520),
      new THREE.Vector3(40, 160, 320),
      new THREE.Vector3(-30, 90, 180),
      new THREE.Vector3(20, 55, 80),
      new THREE.Vector3(-10, 70, 20),
      new THREE.Vector3(25, 110, -40),
      new THREE.Vector3(-40, 140, -90),
      new THREE.Vector3(10, 100, -40),
      new THREE.Vector3(0, 80, 10),
      new THREE.Vector3(0, 60, 0),
      new THREE.Vector3(0, 40, -20),
      new THREE.Vector3(0, 200, 100),
      new THREE.Vector3(0, 80, 300),
    ];
    const looks = [
      new THREE.Vector3(0, 80, 200),
      new THREE.Vector3(0, 60, 100),
      new THREE.Vector3(0, 40, 0),
      new THREE.Vector3(10, 50, -40),
      new THREE.Vector3(-20, 90, -80),
      new THREE.Vector3(0, 120, -60),
      new THREE.Vector3(0, 80, 0),
      new THREE.Vector3(0, 60, 0),
      new THREE.Vector3(0, 50, 0),
      new THREE.Vector3(0, 40, 0),
      new THREE.Vector3(0, 30, 0),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -200),
    ];
    this.path = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.35);
    this.lookPath = new THREE.CatmullRomCurve3(looks, false, 'catmullrom', 0.35);

    window.addEventListener('pointermove', (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    });
  }

  resize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  update(progress: number, knobs: { finale: number; core: number; silence: number }): void {
    this.mouseSmooth.x = lerp(this.mouseSmooth.x, this.mouse.x, 0.04);
    this.mouseSmooth.y = lerp(this.mouseSmooth.y, this.mouse.y, 0.04);

    // Remap progress with slight hold near core/finale
    let t = progress;
    if (knobs.finale > 0.01) {
      // Pull toward space viewpoint
      t = lerp(t, 0.98, knobs.finale);
    }

    this.path.getPointAt(clamp(t, 0, 1), this.tmp);
    this.lookPath.getPointAt(clamp(t, 0, 1), this.tmpLook);

    // Subtle mouse parallax
    this.tmp.x += this.mouseSmooth.x * 8;
    this.tmp.y += -this.mouseSmooth.y * 5;
    this.tmpLook.x += this.mouseSmooth.x * 4;

    // Finale: pull back to see spherical city
    if (knobs.finale > 0) {
      this.tmp.lerp(new THREE.Vector3(0, 40, 280), knobs.finale);
      this.tmpLook.lerp(new THREE.Vector3(0, 0, -80), knobs.finale);
    }

    this.camera.position.lerp(this.tmp, 0.12);
    this.camera.up.copy(this.up);
    // Mild roll during gravity failure is applied by App via knobs externally if needed
    this.camera.lookAt(this.tmpLook);

    // FOV breathe
    const targetFov = lerp(52, 62, knobs.core * 0.5) - knobs.silence * 8 + knobs.finale * 4;
    this.camera.fov = lerp(this.camera.fov, targetFov, 0.05);
    this.camera.updateProjectionMatrix();
  }
}
