import * as THREE from 'three';
import { clamp, lerp } from '../utils/math';

/**
 * Hero-shot camera director — readable cinematic beats along scroll.
 * INTRO aerial → DESCENT between megatowers → CANYON under skyway →
 * FRACTURE roll → FOLD through geometry → CORE wound → SILENCE drift → FINALE pullback.
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
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.8, 3200);
    this.camera.position.set(0, 260, 620);

    // Position beats (progress ≈ evenly spaced along spline)
    const pts = [
      // INTRO — slow aerial, skyline fills frame
      new THREE.Vector3(20, 290, 680),
      new THREE.Vector3(10, 250, 520),
      // DESCENT — drop between two megatowers (sense of height)
      new THREE.Vector3(-28, 200, 340),
      new THREE.Vector3(-18, 130, 240),
      // CANYON — low fly under skyway
      new THREE.Vector3(6, 38, 150),
      new THREE.Vector3(12, 32, 90),
      // FRACTURE — rise slightly, look at cracking towers
      new THREE.Vector3(-15, 55, 40),
      new THREE.Vector3(20, 85, -10),
      // FOLD / COLLAPSE — push through rotating geometry toward core
      new THREE.Vector3(-25, 70, -30),
      new THREE.Vector3(8, 55, -5),
      // CORE — approach wound
      new THREE.Vector3(0, 52, 35),
      new THREE.Vector3(0, 50, 8),
      // SILENCE — slow drift through debris
      new THREE.Vector3(18, 42, -25),
      new THREE.Vector3(-10, 60, -50),
      // FINALE — pull back to reveal spherical city rings
      new THREE.Vector3(0, 90, 180),
      new THREE.Vector3(0, 55, 320),
    ];

    const looks = [
      new THREE.Vector3(0, 110, 200),
      new THREE.Vector3(0, 90, 80),
      new THREE.Vector3(0, 80, 60),
      new THREE.Vector3(5, 50, 20),
      new THREE.Vector3(20, 40, 40),
      new THREE.Vector3(30, 55, -20),
      new THREE.Vector3(-40, 90, -40),
      new THREE.Vector3(0, 70, -60),
      new THREE.Vector3(0, 50, -20),
      new THREE.Vector3(0, 48, -10),
      new THREE.Vector3(0, 48, -10),
      new THREE.Vector3(0, 48, -10),
      new THREE.Vector3(-20, 30, -40),
      new THREE.Vector3(0, 20, -80),
      new THREE.Vector3(0, 0, -100),
      new THREE.Vector3(0, 0, -120),
    ];

    this.path = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.28);
    this.lookPath = new THREE.CatmullRomCurve3(looks, false, 'catmullrom', 0.28);

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
    this.mouseSmooth.x = lerp(this.mouseSmooth.x, this.mouse.x, 0.035);
    this.mouseSmooth.y = lerp(this.mouseSmooth.y, this.mouse.y, 0.035);

    // Remap: linger slightly in canyon & core
    let t = progress;
    if (progress < 0.3) {
      t = progress * 0.92; // slower intro/descent feel via spline density
    }
    if (knobs.finale > 0.01) {
      t = lerp(t, 0.98, knobs.finale);
    }

    this.path.getPointAt(clamp(t, 0, 1), this.tmp);
    this.lookPath.getPointAt(clamp(t, 0, 1), this.tmpLook);

    // Subtle mouse parallax (avoid nausea)
    const para = 1 - knobs.core * 0.4;
    this.tmp.x += this.mouseSmooth.x * 6 * para;
    this.tmp.y += -this.mouseSmooth.y * 4 * para;
    this.tmpLook.x += this.mouseSmooth.x * 3 * para;

    // Finale: pull back to see spherical city
    if (knobs.finale > 0) {
      this.tmp.lerp(new THREE.Vector3(0, 50, 340), knobs.finale);
      this.tmpLook.lerp(new THREE.Vector3(0, 0, -90), knobs.finale);
    }

    this.camera.position.lerp(this.tmp, 0.1);

    // Mild roll during fracture / gravity / fold — cinematic, not vomit
    const targetRoll =
      knobs.fracture * 0.06 * Math.sin(progress * 20) +
      knobs.gravity * 0.1 +
      knobs.fold * -0.12 +
      knobs.silence * 0.03;
    this.roll = lerp(this.roll, targetRoll, 0.04);
    this.tmpUp.set(Math.sin(this.roll), Math.cos(this.roll), 0).normalize();
    this.camera.up.copy(this.tmpUp);
    this.camera.lookAt(this.tmpLook);

    // Intentional FOV: tighter aerial, wider canyon, breathe at core, flatten silence
    let targetFov = 48;
    if (progress < 0.12) targetFov = 46;
    else if (progress < 0.28) targetFov = 52;
    else if (progress < 0.45) targetFov = 55;
    targetFov += knobs.core * 6 - knobs.silence * 10 + knobs.finale * 5;
    this.camera.fov = lerp(this.camera.fov, targetFov, 0.05);
    this.camera.updateProjectionMatrix();
  }
}
