import * as THREE from 'three';
import { clamp, lerp } from '../utils/math';
import { getCameraCurve, getLookCurve } from './path';

/**
 * Corridor camera director — readable cinematic beats along scroll.
 * INTRO aerial → DESCENT into avenue → CANYON under skyways →
 * late surreal → CORE → SILENCE → FINALE pullback.
 * Always stays inside the authored clearance tube (CityGenerator honors it).
 */
export class CameraDirector {
  readonly camera: THREE.PerspectiveCamera;
  private path: THREE.CatmullRomCurve3;
  private lookPath: THREE.CatmullRomCurve3;
  private mouse = new THREE.Vector2(0, 0);
  private mouseSmooth = new THREE.Vector2(0, 0);
  private tmp = new THREE.Vector3();
  private tmpLook = new THREE.Vector3();
  private tmpUp = new THREE.Vector3(0, 1, 0);
  private roll = 0;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.8, 4000);
    this.camera.position.set(0, 310, 760);

    this.path = getCameraCurve();
    this.lookPath = getLookCurve();

    window.addEventListener('pointermove', (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    });
  }

  resize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  update(
    progress: number,
    knobs: { finale: number; core: number; silence: number; fracture: number; gravity: number; fold: number }
  ): void {
    this.mouseSmooth.x = lerp(this.mouseSmooth.x, this.mouse.x, 0.03);
    this.mouseSmooth.y = lerp(this.mouseSmooth.y, this.mouse.y, 0.03);

    // Remap: linger in intro + canyon; accelerate only after trust earned
    let t = progress;
    if (progress < 0.35) {
      // Stretch early establishing / canyon — more scroll for readable flythrough
      t = progress * 0.72;
    } else if (progress < 0.7) {
      t = 0.252 + (progress - 0.35) * 0.95;
    } else {
      t = 0.5845 + (progress - 0.7) * 1.385;
    }
    t = clamp(t, 0, 1);

    if (knobs.finale > 0.01) {
      t = lerp(t, 0.99, knobs.finale);
    }

    this.path.getPointAt(t, this.tmp);
    this.lookPath.getPointAt(t, this.tmpLook);

    // Tiny mouse parallax — never enough to leave the corridor
    const para = (1 - knobs.core * 0.5) * (progress < 0.35 ? 0.35 : 0.7);
    this.tmp.x += this.mouseSmooth.x * 3.5 * para;
    this.tmp.y += -this.mouseSmooth.y * 2.5 * para;
    this.tmpLook.x += this.mouseSmooth.x * 2 * para;

    // Finale: authored pullback outside the city
    if (knobs.finale > 0) {
      this.tmp.lerp(new THREE.Vector3(0, 60, 400), knobs.finale);
      this.tmpLook.lerp(new THREE.Vector3(0, 0, -100), knobs.finale);
    }

    // Smooth cinematic follow — no jitter
    this.camera.position.lerp(this.tmp, 0.085);

    // Very mild roll only after fracture begins — no early vomit
    const late = Math.max(0, progress - 0.38);
    const targetRoll =
      knobs.fracture * 0.04 * Math.sin(late * 14) +
      knobs.gravity * 0.07 +
      knobs.fold * -0.09 +
      knobs.silence * 0.02;
    this.roll = lerp(this.roll, targetRoll, 0.035);
    this.tmpUp.set(Math.sin(this.roll), Math.cos(this.roll), 0).normalize();
    this.camera.up.copy(this.tmpUp);
    this.camera.lookAt(this.tmpLook);

    // Stable FOV ~45–55
    let targetFov = 50;
    if (progress < 0.12) targetFov = 46;
    else if (progress < 0.3) targetFov = 50;
    else if (progress < 0.5) targetFov = 52;
    targetFov += knobs.core * 4 - knobs.silence * 8 + knobs.finale * 4;
    targetFov = clamp(targetFov, 44, 56);
    this.camera.fov = lerp(this.camera.fov, targetFov, 0.04);
    this.camera.updateProjectionMatrix();
  }
}
