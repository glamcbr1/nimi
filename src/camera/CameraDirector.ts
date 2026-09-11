import * as THREE from 'three';
import { clamp, lerp } from '../utils/math';
import { getCameraCurve, getLookCurve } from './path';

/**
 * Corridor camera director — readable cinematic beats along scroll.
 * INTRO aerial → DESCENT into avenue → CANYON under skyways →
 * late surreal → CORE → SILENCE → FINALE pullback.
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
    // Near plane safe — never clip streets; far covers horizon megastructures
    this.camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 1.2, 4500);
    this.camera.position.set(0, 330, 820);

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
    this.mouseSmooth.x = lerp(this.mouseSmooth.x, this.mouse.x, 0.025);
    this.mouseSmooth.y = lerp(this.mouseSmooth.y, this.mouse.y, 0.025);

    // Remap: linger intro + canyon hard; accelerate only after trust
    let t = progress;
    if (progress < 0.38) {
      t = progress * 0.68; // stretch establishing
    } else if (progress < 0.72) {
      t = 0.2584 + (progress - 0.38) * 0.92;
    } else {
      t = 0.5712 + (progress - 0.72) * 1.53;
    }
    t = clamp(t, 0, 1);

    if (knobs.finale > 0.01) {
      t = lerp(t, 0.99, knobs.finale);
    }

    this.path.getPointAt(t, this.tmp);
    this.lookPath.getPointAt(t, this.tmpLook);

    // Tiny mouse parallax — never leave corridor
    const para = (1 - knobs.core * 0.5) * (progress < 0.38 ? 0.28 : 0.6);
    this.tmp.x += this.mouseSmooth.x * 2.8 * para;
    this.tmp.y += -this.mouseSmooth.y * 2.0 * para;
    this.tmpLook.x += this.mouseSmooth.x * 1.6 * para;

    if (knobs.finale > 0) {
      this.tmp.lerp(new THREE.Vector3(0, 60, 400), knobs.finale);
      this.tmpLook.lerp(new THREE.Vector3(0, 0, -100), knobs.finale);
    }

    // Slower cinematic follow
    this.camera.position.lerp(this.tmp, 0.065);

    // Less roll noise — only intentional gentle banking mid-fracture
    const late = Math.max(0, progress - 0.4);
    const targetRoll =
      knobs.fracture * 0.028 * Math.sin(late * 10) +
      knobs.gravity * 0.05 +
      knobs.fold * -0.07 +
      knobs.silence * 0.015;
    this.roll = lerp(this.roll, targetRoll, 0.028);
    this.tmpUp.set(Math.sin(this.roll), Math.cos(this.roll), 0).normalize();
    this.camera.up.copy(this.tmpUp);
    this.camera.lookAt(this.tmpLook);

    let targetFov = 48;
    if (progress < 0.1) targetFov = 44; // postcard wide-but-tight
    else if (progress < 0.32) targetFov = 48;
    else if (progress < 0.5) targetFov = 50;
    targetFov += knobs.core * 3 - knobs.silence * 7 + knobs.finale * 3;
    targetFov = clamp(targetFov, 42, 54);
    this.camera.fov = lerp(this.camera.fov, targetFov, 0.035);
    this.camera.updateProjectionMatrix();
  }
}
