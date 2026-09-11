import * as THREE from 'three';

/**
 * Finale: spherical city rings floating in void — surreal, not a toy planet.
 */
export class CollapseSystem {
  readonly group = new THREE.Group();
  private sphereCity: THREE.Group;
  private planet: THREE.Mesh;
  private rings: THREE.Mesh[] = [];
  private stars: THREE.Points;
  private buildings: THREE.InstancedMesh;
  private debris: THREE.Points;
  private strength = 0;

  constructor() {
    this.sphereCity = new THREE.Group();

    // Deep starfield
    const starCount = 2800;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 500 + Math.random() * 1200;
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
      new THREE.PointsMaterial({
        color: 0xb8c8e8,
        size: 1.1,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      })
    );
    this.group.add(this.stars);

    // Dark core shell
    this.planet = new THREE.Mesh(
      new THREE.IcosahedronGeometry(42, 3),
      new THREE.MeshStandardMaterial({
        color: 0x060a12,
        emissive: 0x101828,
        emissiveIntensity: 0.35,
        roughness: 0.9,
        metalness: 0.25,
        flatShading: true,
      })
    );
    this.sphereCity.add(this.planet);

    // Buildings protruding from sphere
    const count = 520;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x101820,
      emissive: 0x4de8ff,
      emissiveIntensity: 0.35,
      roughness: 0.7,
      metalness: 0.4,
    });
    this.buildings = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = Math.acos(2 * Math.random() - 1);
      const r = 42;
      const dir = new THREE.Vector3(Math.sin(b) * Math.cos(a), Math.sin(b) * Math.sin(a), Math.cos(b));
      const h = 2 + Math.random() * 16;
      dummy.position.copy(dir).multiplyScalar(r + h * 0.5);
      dummy.scale.set(0.8 + Math.random() * 2.2, h, 0.8 + Math.random() * 2.2);
      dummy.lookAt(0, 0, 0);
      dummy.rotateX(Math.PI / 2);
      dummy.updateMatrix();
      this.buildings.setMatrixAt(i, dummy.matrix);
      color.setHSL(0.52 + Math.random() * 0.12, 0.55, 0.35 + Math.random() * 0.25);
      this.buildings.setColorAt(i, color);
    }
    if (this.buildings.instanceColor) this.buildings.instanceColor.needsUpdate = true;
    this.sphereCity.add(this.buildings);

    // Multiple rings — eclipsed / spherical city rings
    const ringDefs = [
      { r: 58, tube: 0.45, col: 0xff3d9a, tilt: Math.PI / 2.5, op: 0.65 },
      { r: 72, tube: 0.3, col: 0x4de8ff, tilt: Math.PI / 2.1, op: 0.45 },
      { r: 88, tube: 0.55, col: 0xa0b0c8, tilt: Math.PI / 2.8, op: 0.3 },
      { r: 105, tube: 0.2, col: 0xff3d9a, tilt: Math.PI / 1.9, op: 0.35 },
    ];
    for (const rd of ringDefs) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(rd.r, rd.tube, 8, 160),
        new THREE.MeshBasicMaterial({
          color: rd.col,
          transparent: true,
          opacity: rd.op,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      ring.rotation.x = rd.tilt;
      ring.rotation.y = Math.random() * 0.4;
      this.rings.push(ring);
      this.sphereCity.add(ring);
    }

    // Drift debris field around finale
    const debCount = 400;
    const debPos = new Float32Array(debCount * 3);
    for (let i = 0; i < debCount; i++) {
      const r = 50 + Math.random() * 160;
      const a = Math.random() * Math.PI * 2;
      const b = Math.acos(2 * Math.random() - 1);
      debPos[i * 3] = r * Math.sin(b) * Math.cos(a);
      debPos[i * 3 + 1] = r * Math.sin(b) * Math.sin(a);
      debPos[i * 3 + 2] = r * Math.cos(b);
    }
    const debGeo = new THREE.BufferGeometry();
    debGeo.setAttribute('position', new THREE.BufferAttribute(debPos, 3));
    this.debris = new THREE.Points(
      debGeo,
      new THREE.PointsMaterial({
        color: 0x88aacc,
        size: 1.4,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      })
    );
    this.sphereCity.add(this.debris);

    this.sphereCity.position.set(0, 0, -90);
    this.group.add(this.sphereCity);
    this.group.visible = false;
  }

  setStrength(s: number): void {
    this.strength = s;
    this.group.visible = s > 0.02;
    this.sphereCity.scale.setScalar(0.25 + s * 1.05);
  }

  update(time: number): void {
    if (this.strength < 0.02) return;
    this.sphereCity.rotation.y = time * 0.07;
    this.sphereCity.rotation.x = Math.sin(time * 0.1) * 0.08;
    for (let i = 0; i < this.rings.length; i++) {
      this.rings[i].rotation.z = time * (0.08 + i * 0.03) * (i % 2 === 0 ? 1 : -1);
    }
    this.stars.rotation.y = time * 0.008;
    this.debris.rotation.y = -time * 0.04;
  }

  dispose(): void {
    this.planet.geometry.dispose();
    (this.planet.material as THREE.Material).dispose();
    this.buildings.geometry.dispose();
    (this.buildings.material as THREE.Material).dispose();
    for (const r of this.rings) {
      r.geometry.dispose();
      (r.material as THREE.Material).dispose();
    }
    this.stars.geometry.dispose();
    (this.stars.material as THREE.Material).dispose();
    this.debris.geometry.dispose();
    (this.debris.material as THREE.Material).dispose();
  }
}
