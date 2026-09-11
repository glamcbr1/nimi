import * as THREE from 'three';

export class SceneManager {
  readonly scene: THREE.Scene;
  readonly root: THREE.Group;
  readonly cityRoot: THREE.Group;
  readonly fxRoot: THREE.Group;
  readonly finaleRoot: THREE.Group;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x070b16, 0.0018);
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

    const hemi = new THREE.HemisphereLight(0x1a2a44, 0x05070e, 0.55);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0x8aa0c0, 0.35);
    key.position.set(40, 120, 60);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x4de8ff, 0.12);
    fill.position.set(-80, 40, -40);
    this.scene.add(fill);

    const rim = new THREE.PointLight(0xff3d9a, 0.0, 400, 2);
    rim.position.set(0, 80, 0);
    rim.name = 'fractureRim';
    this.scene.add(rim);
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
