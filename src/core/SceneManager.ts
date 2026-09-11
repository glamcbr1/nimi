import * as THREE from 'three';

export class SceneManager {
  readonly scene: THREE.Scene;
  readonly root: THREE.Group;
  readonly cityRoot: THREE.Group;
  readonly fxRoot: THREE.Group;
  readonly finaleRoot: THREE.Group;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x060a14, 0.00145);
    this.scene.background = new THREE.Color(0x03050c);

    this.root = new THREE.Group();
    this.cityRoot = new THREE.Group();
    this.fxRoot = new THREE.Group();
    this.finaleRoot = new THREE.Group();
    this.finaleRoot.visible = false;

    this.root.add(this.cityRoot);
    this.root.add(this.fxRoot);
    this.scene.add(this.root);
    this.scene.add(this.finaleRoot);

    // Cold industrial night — layered, restrained
    const hemi = new THREE.HemisphereLight(0x1a2840, 0x03050a, 0.45);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0x7a90b0, 0.28);
    key.position.set(60, 180, 90);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x3a6a88, 0.1);
    fill.position.set(-120, 50, -60);
    this.scene.add(fill);

    // Subtle upward bounce from wet streets
    const bounce = new THREE.DirectionalLight(0x152030, 0.12);
    bounce.position.set(0, -40, 20);
    this.scene.add(bounce);

    const rim = new THREE.PointLight(0xff3d9a, 0.0, 520, 1.8);
    rim.position.set(0, 50, -10);
    rim.name = 'fractureRim';
    this.scene.add(rim);

    const cyanWash = new THREE.PointLight(0x4de8ff, 0.15, 400, 2);
    cyanWash.position.set(40, 100, 160);
    cyanWash.name = 'cyanWash';
    this.scene.add(cyanWash);
  }

  setFog(density: number, color: THREE.ColorRepresentation): void {
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = density;
      this.scene.fog.color.set(color);
    }
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.set(color);
    }
  }

  getFractureLight(): THREE.PointLight {
    return this.scene.getObjectByName('fractureRim') as THREE.PointLight;
  }
}
