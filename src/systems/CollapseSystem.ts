import * as THREE from 'three';

/**
 * Finale spherical city + silence void handling.
 * City folds into a sphere floating in space.
 */
export class CollapseSystem {
  readonly group = new THREE.Group();
  private sphereCity: THREE.Group;
  private planet: THREE.Mesh;
  private ring: THREE.Mesh;
  private stars: THREE.Points;
  private strength = 0;
  private buildings: THREE.InstancedMesh;

  constructor() {
    this.sphereCity = new THREE.Group();

    // Starfield
    const starCount = 2000;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 400 + Math.random() * 800;
      const a = Math.random() * Math.PI * 2;
      const b = Math.acos(2 * Math.random() - 1);
      starPos[i * 3] = r * Math.sin(b) * Math.cos(a);
      starPos[i * 3 + 1] = r * Math.sin(b) * Math.sin(a);
      starPos[i * 3 + 2] = r * Math.cos(b);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xaaccff, size: 1.2, transparent: true, opacity: 0.85 })
    );
    this.group.add(this.stars);

    // Spherical city shell
    this.planet = new THREE.Mesh(
      new THREE.IcosahedronGeometry(48, 3),
      new THREE.MeshStandardMaterial({
        color: 0x0a101c,
        emissive: 0x1a3050,
        emissiveIntensity: 0.4,
        roughness: 0.85,
        metalness: 0.3,
        flatShading: true,
      })
    );
    this.sphereCity.add(this.planet);

    // Buildings protruding from sphere
    const count = 400;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0x4de8ff });
    this.buildings = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = Math.acos(2 * Math.random() - 1);
      const r = 48;
      const dir = new THREE.Vector3(
        Math.sin(b) * Math.cos(a),
        Math.sin(b) * Math.sin(a),
        Math.cos(b)
      );
      const h = 2 + Math.random() * 14;
      dummy.position.copy(dir).multiplyScalar(r + h * 0.5);
      dummy.scale.set(1 + Math.random() * 2, h, 1 + Math.random() * 2);
      dummy.lookAt(0, 0, 0);
      dummy.rotateX(Math.PI / 2);
      dummy.updateMatrix();
      this.buildings.setMatrixAt(i, dummy.matrix);
      color.setHSL(0.55 + Math.random() * 0.1, 0.6, 0.4 + Math.random() * 0.2);
      this.buildings.setColorAt(i, color);
    }
    if (this.buildings.instanceColor) this.buildings.instanceColor.needsUpdate = true;
    this.sphereCity.add(this.buildings);

    // Ring
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(70, 0.8, 8, 128),
      new THREE.MeshBasicMaterial({
        color: 0xff3d9a,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.ring.rotation.x = Math.PI / 2.4;
    this.sphereCity.add(this.ring);

    this.sphereCity.position.set(0, 0, -80);
    this.group.add(this.sphereCity);
    this.group.visible = false;
  }

  setStrength(s: number): void {
    this.strength = s;
    this.group.visible = s > 0.02;
    this.sphereCity.scale.setScalar(0.3 + s * 0.9);
  }

  update(time: number): void {
    if (this.strength < 0.02) return;
    this.sphereCity.rotation.y = time * 0.08;
    this.ring.rotation.z = time * 0.12;
    this.stars.rotation.y = time * 0.01;
  }

  dispose(): void {
    this.planet.geometry.dispose();
    (this.planet.material as THREE.Material).dispose();
    this.buildings.geometry.dispose();
    (this.buildings.material as THREE.Material).dispose();
    this.ring.geometry.dispose();
    (this.ring.material as THREE.Material).dispose();
    this.stars.geometry.dispose();
    (this.stars.material as THREE.Material).dispose();
  }
}
