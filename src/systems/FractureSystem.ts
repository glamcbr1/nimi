import * as THREE from 'three';
import {
  coreVertexShader,
  coreFragmentShader,
  woundDiscVertexShader,
  woundDiscFragmentShader,
} from '../shaders/coreShader';

/** Dimensional wound core — void disc/torus, magenta rim, stretched debris */
export class FractureSystem {
  readonly group = new THREE.Group();
  readonly corePos = new THREE.Vector3(0, 48, -10);
  private coreMat: THREE.ShaderMaterial;
  private discMat: THREE.ShaderMaterial;
  private voidMesh: THREE.Mesh;
  private rim: THREE.Mesh;
  private disc: THREE.Mesh;
  private debris: THREE.InstancedMesh;
  private debrisDummy = new THREE.Object3D();
  private debrisBase: Float32Array;
  private debrisCount = 64;
  private stretch: THREE.Mesh[] = [];
  private intensity = 0;

  constructor() {
    this.group.position.copy(this.corePos);

    // Dark void body — flattened icosahedron (disc-like wound)
    this.coreMat = new THREE.ShaderMaterial({
      vertexShader: coreVertexShader,
      fragmentShader: coreFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0 },
        uColorA: { value: new THREE.Color(0xff3d9a) },
        uColorB: { value: new THREE.Color(0x4de8ff) },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
    });

    this.voidMesh = new THREE.Mesh(new THREE.SphereGeometry(16, 48, 32), this.coreMat);
    this.voidMesh.scale.set(1.6, 0.28, 1.6);
    this.group.add(this.voidMesh);

    // Inner absolute void
    const inner = new THREE.Mesh(
      new THREE.CircleGeometry(10, 48),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
        depthWrite: true,
      })
    );
    inner.rotation.x = -Math.PI / 2;
    inner.name = 'innerVoid';
    this.group.add(inner);

    // Magenta accretion rim (torus)
    this.rim = new THREE.Mesh(
      new THREE.TorusGeometry(18, 0.55, 12, 96),
      new THREE.MeshBasicMaterial({
        color: 0xff3d9a,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.rim.rotation.x = Math.PI / 2;
    this.group.add(this.rim);

    // Secondary cyan ring (tilted)
    const rim2 = new THREE.Mesh(
      new THREE.TorusGeometry(22, 0.25, 8, 80),
      new THREE.MeshBasicMaterial({
        color: 0x4de8ff,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    rim2.rotation.x = Math.PI / 2.3;
    rim2.rotation.z = 0.35;
    rim2.name = 'cyanRing';
    this.group.add(rim2);

    // Energy disc sheet
    this.discMat = new THREE.ShaderMaterial({
      vertexShader: woundDiscVertexShader,
      fragmentShader: woundDiscFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0 },
        uMagenta: { value: new THREE.Color(0xff3d9a) },
        uCyan: { value: new THREE.Color(0x4de8ff) },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(26, 64), this.discMat);
    this.disc.rotation.x = -Math.PI / 2;
    this.group.add(this.disc);

    // Stretched debris shards (radial pull streaks)
    const stretchMat = new THREE.MeshBasicMaterial({
      color: 0xff6bb5,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < 28; i++) {
      const len = 8 + Math.random() * 28;
      const shard = new THREE.Mesh(new THREE.PlaneGeometry(0.35, len), stretchMat.clone());
      const a = Math.random() * Math.PI * 2;
      const r = 14 + Math.random() * 40;
      shard.position.set(Math.cos(a) * r, (Math.random() - 0.5) * 10, Math.sin(a) * r);
      shard.lookAt(0, 0, 0);
      // Orient long axis toward center
      shard.rotateX(Math.PI / 2);
      this.stretch.push(shard);
      this.group.add(shard);
    }

    // Orbiting city fragments
    const dGeo = new THREE.BoxGeometry(1, 1, 1);
    const dMat = new THREE.MeshStandardMaterial({
      color: 0x0c121c,
      emissive: 0x4de8ff,
      emissiveIntensity: 0.2,
      roughness: 0.85,
      metalness: 0.3,
    });
    this.debris = new THREE.InstancedMesh(dGeo, dMat, this.debrisCount);
    this.debris.frustumCulled = false;
    this.debrisBase = new Float32Array(this.debrisCount * 4);
    for (let i = 0; i < this.debrisCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 24 + Math.random() * 55;
      const y = (Math.random() - 0.5) * 30;
      this.debrisBase[i * 4] = a;
      this.debrisBase[i * 4 + 1] = r;
      this.debrisBase[i * 4 + 2] = y;
      this.debrisBase[i * 4 + 3] = 1.5 + Math.random() * 6;
    }
    this.group.add(this.debris);

    this.group.visible = false;
  }

  setIntensity(v: number): void {
    this.intensity = v;
    this.group.visible = v > 0.02;
    this.coreMat.uniforms.uIntensity.value = v;
    this.discMat.uniforms.uIntensity.value = v;
    this.group.scale.setScalar(0.75 + v * 1.35);
    (this.rim.material as THREE.MeshBasicMaterial).opacity = 0.35 + v * 0.55;
  }

  update(time: number): void {
    if (this.intensity < 0.02) return;
    this.coreMat.uniforms.uTime.value = time;
    this.discMat.uniforms.uTime.value = time;

    this.voidMesh.rotation.y = time * 0.15;
    this.rim.rotation.z = time * 0.25;
    const cyan = this.group.getObjectByName('cyanRing');
    if (cyan) cyan.rotation.z = -time * 0.18;

    const pulse = 1 + Math.sin(time * 2.4) * 0.04 * this.intensity;
    this.disc.scale.setScalar(pulse);

    for (let i = 0; i < this.stretch.length; i++) {
      const s = this.stretch[i];
      s.scale.y = 1 + Math.sin(time * 2 + i) * 0.15 * this.intensity;
      (s.material as THREE.MeshBasicMaterial).opacity = 0.25 + this.intensity * 0.45;
    }

    for (let i = 0; i < this.debrisCount; i++) {
      const a = this.debrisBase[i * 4] + time * (0.12 + (i % 5) * 0.02) * this.intensity;
      const r = this.debrisBase[i * 4 + 1] * (1 - this.intensity * 0.15);
      const y = this.debrisBase[i * 4 + 2] + Math.sin(time * 0.8 + i) * 2;
      const sz = this.debrisBase[i * 4 + 3];
      // Stretch toward center as intensity rises
      const stretch = 1 + this.intensity * 2.5;
      this.debrisDummy.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      this.debrisDummy.scale.set(sz * 0.4, sz * 0.5, sz * stretch);
      this.debrisDummy.lookAt(0, y * 0.3, 0);
      this.debrisDummy.updateMatrix();
      this.debris.setMatrixAt(i, this.debrisDummy.matrix);
    }
    this.debris.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.voidMesh.geometry.dispose();
    this.coreMat.dispose();
    this.disc.geometry.dispose();
    this.discMat.dispose();
    this.rim.geometry.dispose();
    (this.rim.material as THREE.Material).dispose();
    this.debris.geometry.dispose();
    (this.debris.material as THREE.Material).dispose();
  }
}
