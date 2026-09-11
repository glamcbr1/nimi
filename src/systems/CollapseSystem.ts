import * as THREE from 'three';

/**
 * Finale: spherical city rings floating in void — huge, readable, intentional.
 */
export class CollapseSystem {
  readonly group = new THREE.Group();
  private sphereCity: THREE.Group;
  private planet: THREE.Mesh;
  private rings: THREE.Mesh[] = [];
  private stars: THREE.Points;
  private buildings: THREE.InstancedMesh;
  private debris: THREE.InstancedMesh;
  private debrisPts: THREE.Points;
  private accretion: THREE.Mesh;
  private strength = 0;
  private dummy = new THREE.Object3D();

  constructor() {
    this.sphereCity = new THREE.Group();

    const starCount = 3200;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 600 + Math.random() * 1400;
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
        color: 0xc0d0f0,
        size: 1.2,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      })
    );
    this.group.add(this.stars);

    // Dark core shell — larger presence
    this.planet = new THREE.Mesh(
      new THREE.IcosahedronGeometry(52, 3),
      new THREE.MeshStandardMaterial({
        color: 0x050910,
        emissive: 0x141e30,
        emissiveIntensity: 0.4,
        roughness: 0.92,
        metalness: 0.28,
        flatShading: true,
      })
    );
    this.sphereCity.add(this.planet);

    // Inner glow
    const innerGlow = new THREE.Mesh(
      new THREE.IcosahedronGeometry(48, 2),
      new THREE.MeshBasicMaterial({
        color: 0xff3d9a,
        transparent: true,
        opacity: 0.08,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.sphereCity.add(innerGlow);

    // Buildings as block districts on sphere
    const count = 640;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0e161f,
      emissive: 0x4de8ff,
      emissiveIntensity: 0.4,
      roughness: 0.7,
      metalness: 0.4,
    });
    this.buildings = new THREE.InstancedMesh(geo, mat, count);
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = Math.acos(2 * Math.random() - 1);
      const r = 52;
      const dir = new THREE.Vector3(Math.sin(b) * Math.cos(a), Math.sin(b) * Math.sin(a), Math.cos(b));
      const h = 3 + Math.random() * 22;
      this.dummy.position.copy(dir).multiplyScalar(r + h * 0.5);
      this.dummy.scale.set(1.0 + Math.random() * 3.2, h, 1.0 + Math.random() * 3.2);
      this.dummy.lookAt(0, 0, 0);
      this.dummy.rotateX(Math.PI / 2);
      this.dummy.updateMatrix();
      this.buildings.setMatrixAt(i, this.dummy.matrix);
      color.setHSL(0.52 + Math.random() * 0.12, 0.55, 0.32 + Math.random() * 0.28);
      this.buildings.setColorAt(i, color);
    }
    if (this.buildings.instanceColor) this.buildings.instanceColor.needsUpdate = true;
    this.sphereCity.add(this.buildings);

    // Accretion disc — dimensional wound readable
    this.accretion = new THREE.Mesh(
      new THREE.RingGeometry(58, 95, 96),
      new THREE.MeshBasicMaterial({
        color: 0xff3d9a,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.accretion.rotation.x = Math.PI / 2.15;
    this.sphereCity.add(this.accretion);

    const ringDefs = [
      { r: 70, tube: 0.7, col: 0xff3d9a, tilt: Math.PI / 2.4, op: 0.7 },
      { r: 88, tube: 0.4, col: 0x4de8ff, tilt: Math.PI / 2.05, op: 0.5 },
      { r: 108, tube: 0.65, col: 0xa8b8d0, tilt: Math.PI / 2.7, op: 0.32 },
      { r: 128, tube: 0.28, col: 0xff3d9a, tilt: Math.PI / 1.95, op: 0.4 },
      { r: 150, tube: 0.5, col: 0x4de8ff, tilt: Math.PI / 2.55, op: 0.22 },
    ];
    for (const rd of ringDefs) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(rd.r, rd.tube, 10, 180),
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

    // Chunk debris fields (readable blocks, not dust)
    const debCount = 180;
    this.debris = new THREE.InstancedMesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: 0x121820,
        emissive: 0x2a4060,
        emissiveIntensity: 0.25,
        roughness: 0.85,
        metalness: 0.3,
      }),
      debCount
    );
    for (let i = 0; i < debCount; i++) {
      const r = 70 + Math.random() * 180;
      const a = Math.random() * Math.PI * 2;
      const b = Math.acos(2 * Math.random() - 1);
      this.dummy.position.set(
        r * Math.sin(b) * Math.cos(a),
        r * Math.sin(b) * Math.sin(a),
        r * Math.cos(b)
      );
      const s = 1.5 + Math.random() * 8;
      this.dummy.scale.set(s * (0.4 + Math.random()), s, s * (0.4 + Math.random()));
      this.dummy.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
      this.dummy.updateMatrix();
      this.debris.setMatrixAt(i, this.dummy.matrix);
    }
    this.sphereCity.add(this.debris);

    const dustN = 500;
    const dustPos = new Float32Array(dustN * 3);
    for (let i = 0; i < dustN; i++) {
      const r = 55 + Math.random() * 200;
      const a = Math.random() * Math.PI * 2;
      const b = Math.acos(2 * Math.random() - 1);
      dustPos[i * 3] = r * Math.sin(b) * Math.cos(a);
      dustPos[i * 3 + 1] = r * Math.sin(b) * Math.sin(a);
      dustPos[i * 3 + 2] = r * Math.cos(b);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    this.debrisPts = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({
        color: 0x88aacc,
        size: 1.5,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      })
    );
    this.sphereCity.add(this.debrisPts);

    this.sphereCity.position.set(0, 0, -90);
    this.group.add(this.sphereCity);
    this.group.visible = false;
  }

  setStrength(s: number): void {
    this.strength = s;
    this.group.visible = s > 0.02;
    // Huge readable scale-up
    this.sphereCity.scale.setScalar(0.2 + s * 1.35);
    (this.accretion.material as THREE.MeshBasicMaterial).opacity = 0.15 + s * 0.35;
  }

  update(time: number): void {
    if (this.strength < 0.02) return;
    this.sphereCity.rotation.y = time * 0.055;
    this.sphereCity.rotation.x = Math.sin(time * 0.08) * 0.06;
    this.accretion.rotation.z = time * 0.12;
    for (let i = 0; i < this.rings.length; i++) {
      this.rings[i].rotation.z = time * (0.06 + i * 0.025) * (i % 2 === 0 ? 1 : -1);
    }
    this.stars.rotation.y = time * 0.006;
    this.debris.rotation.y = -time * 0.03;
    this.debrisPts.rotation.y = -time * 0.035;
  }

  dispose(): void {
    this.planet.geometry.dispose();
    (this.planet.material as THREE.Material).dispose();
    this.buildings.geometry.dispose();
    (this.buildings.material as THREE.Material).dispose();
    this.debris.geometry.dispose();
    (this.debris.material as THREE.Material).dispose();
    for (const r of this.rings) {
      r.geometry.dispose();
      (r.material as THREE.Material).dispose();
    }
    this.stars.geometry.dispose();
    (this.stars.material as THREE.Material).dispose();
    this.debrisPts.geometry.dispose();
    (this.debrisPts.material as THREE.Material).dispose();
    this.accretion.geometry.dispose();
    (this.accretion.material as THREE.Material).dispose();
  }
}
