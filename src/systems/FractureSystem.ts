import * as THREE from 'three';
import { coreVertexShader, coreFragmentShader } from '../shaders/coreShader';

/** Dimensional wound core + crack ribbons */
export class FractureSystem {
  readonly group = new THREE.Group();
  readonly corePos = new THREE.Vector3(0, 50, 0);
  private core: THREE.Mesh;
  private coreMat: THREE.ShaderMaterial;
  private cracks: THREE.Group;
  private rings: THREE.Mesh[] = [];
  private intensity = 0;

  constructor() {
    this.group.position.copy(this.corePos);

    this.coreMat = new THREE.ShaderMaterial({
      vertexShader: coreVertexShader,
      fragmentShader: coreFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0 },
        uColorA: { value: new THREE.Color(0xff1a3c) },
        uColorB: { value: new THREE.Color(0xff6b2a) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.core = new THREE.Mesh(new THREE.IcosahedronGeometry(14, 3), this.coreMat);
    this.group.add(this.core);

    // Inner wound
    const inner = new THREE.Mesh(
      new THREE.IcosahedronGeometry(7, 2),
      new THREE.MeshBasicMaterial({
        color: 0xffe0a0,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    inner.name = 'innerWound';
    this.group.add(inner);

    // Orbital debris shards
    this.cracks = new THREE.Group();
    const shardMat = new THREE.MeshBasicMaterial({
      color: 0x4de8ff,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < 48; i++) {
      const shard = new THREE.Mesh(
        new THREE.PlaneGeometry(0.6, 8 + Math.random() * 18),
        shardMat.clone()
      );
      const a = Math.random() * Math.PI * 2;
      const r = 18 + Math.random() * 50;
      shard.position.set(Math.cos(a) * r, (Math.random() - 0.5) * 40, Math.sin(a) * r);
      shard.lookAt(0, 0, 0);
      this.cracks.add(shard);
    }
    this.group.add(this.cracks);

    // Energy rings
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(20 + i * 10, 0.35, 8, 64),
        new THREE.MeshBasicMaterial({
          color: i === 1 ? 0xff3d9a : 0x4de8ff,
          transparent: true,
          opacity: 0.4,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      ring.rotation.x = Math.PI / 2 + (i - 1) * 0.4;
      this.rings.push(ring);
      this.group.add(ring);
    }

    this.group.visible = false;
  }

  setIntensity(v: number): void {
    this.intensity = v;
    this.group.visible = v > 0.02;
    this.coreMat.uniforms.uIntensity.value = v;
    this.group.scale.setScalar(0.6 + v * 1.2);
  }

  update(time: number): void {
    if (this.intensity < 0.02) return;
    this.coreMat.uniforms.uTime.value = time;
    this.core.rotation.y = time * 0.35;
    this.core.rotation.x = Math.sin(time * 0.4) * 0.3;
    this.cracks.rotation.y = time * 0.2;
    for (let i = 0; i < this.rings.length; i++) {
      this.rings[i].rotation.z = time * (0.3 + i * 0.15);
      this.rings[i].scale.setScalar(1 + Math.sin(time * 2 + i) * 0.05 * this.intensity);
    }
    const inner = this.group.getObjectByName('innerWound');
    if (inner) {
      inner.scale.setScalar(0.8 + Math.sin(time * 3) * 0.15 * this.intensity);
    }
  }

  dispose(): void {
    this.core.geometry.dispose();
    this.coreMat.dispose();
  }
}
