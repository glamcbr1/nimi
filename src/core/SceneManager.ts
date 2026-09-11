import * as THREE from 'three';

/**
 * Layered cinematic night lighting + cheap volumetrics + lightning pulses.
 * Hemisphere + key + fill + bounce + sparse street practicals + fracture rims.
 */
export class SceneManager {
  readonly scene: THREE.Scene;
  readonly root: THREE.Group;
  readonly cityRoot: THREE.Group;
  readonly fxRoot: THREE.Group;
  readonly finaleRoot: THREE.Group;

  private hemi: THREE.HemisphereLight;
  private key: THREE.DirectionalLight;
  private fill: THREE.DirectionalLight;
  private bounce: THREE.DirectionalLight;
  private fractureRim: THREE.PointLight;
  private fractureCyan: THREE.PointLight;
  private cyanWash: THREE.PointLight;
  private streetLights: THREE.PointLight[] = [];
  private shaftMats: THREE.ShaderMaterial[] = [];
  private skyMat!: THREE.ShaderMaterial;
  private cloudFlash = 0;
  private cloudFlashTarget = 0;
  private nextLightning = 2.5;
  private doubleFlashAt = -1;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x060a14, 0.00115);
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

    this.hemi = new THREE.HemisphereLight(0x1c2a42, 0x020408, 0.55);
    this.scene.add(this.hemi);

    this.key = new THREE.DirectionalLight(0x8aa0bc, 0.38);
    this.key.position.set(80, 220, 120);
    this.scene.add(this.key);

    this.fill = new THREE.DirectionalLight(0x3a6888, 0.14);
    this.fill.position.set(-140, 60, -80);
    this.scene.add(this.fill);

    this.bounce = new THREE.DirectionalLight(0x1a2838, 0.18);
    this.bounce.position.set(0, -50, 40);
    this.scene.add(this.bounce);

    this.fractureRim = new THREE.PointLight(0xff3d9a, 0.0, 620, 1.6);
    this.fractureRim.position.set(0, 50, -10);
    this.fractureRim.name = 'fractureRim';
    this.scene.add(this.fractureRim);

    this.fractureCyan = new THREE.PointLight(0x4de8ff, 0.0, 480, 1.8);
    this.fractureCyan.position.set(30, 70, 20);
    this.fractureCyan.name = 'fractureCyan';
    this.scene.add(this.fractureCyan);

    this.cyanWash = new THREE.PointLight(0x4de8ff, 0.12, 420, 2.2);
    this.cyanWash.position.set(50, 110, 180);
    this.cyanWash.name = 'cyanWash';
    this.scene.add(this.cyanWash);

    this.addStreetPracticals();
    this.addSkyDome();
    this.addVolumetricShafts();
  }

  private addStreetPracticals(): void {
    const zs = [420, 340, 260, 190, 130, 70, 20, -30, -80];
    for (let i = 0; i < zs.length; i++) {
      for (const side of [-1, 1] as const) {
        if ((i + (side > 0 ? 1 : 0)) % 2 === 0) continue;
        const warm = new THREE.PointLight(0xffb070, 0.55, 55, 2.0);
        warm.position.set(side * 28, 9.5, zs[i]);
        warm.userData.base = 0.55;
        this.streetLights.push(warm);
        this.scene.add(warm);

        const fixture = new THREE.Mesh(
          new THREE.BoxGeometry(0.35, 0.8, 0.35),
          new THREE.MeshBasicMaterial({ color: 0xffc090 })
        );
        fixture.position.copy(warm.position);
        fixture.position.y = 8.2;
        this.cityRoot.add(fixture);

        const pole = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 8, 0.18),
          new THREE.MeshBasicMaterial({ color: 0x1a222c })
        );
        pole.position.set(warm.position.x, 4, warm.position.z);
        this.cityRoot.add(pole);
      }
    }

    const plaza: Array<[number, number, number]> = [
      [-55, 14, 200],
      [58, 14, 160],
      [-60, 12, 90],
      [62, 16, 40],
    ];
    for (const [x, y, z] of plaza) {
      const p = new THREE.PointLight(0xffa060, 0.4, 70, 2.1);
      p.position.set(x, y, z);
      p.userData.base = 0.4;
      this.streetLights.push(p);
      this.scene.add(p);
    }
  }

  private addSkyDome(): void {
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uFlash: { value: 0 },
        uTop: { value: new THREE.Color(0x0a1428) },
        uHorizon: { value: new THREE.Color(0x121c30) },
        uBottom: { value: new THREE.Color(0x05080f) },
        uFracture: { value: 0 },
        uMagenta: { value: new THREE.Color(0xff3d9a) },
        uCyan: { value: new THREE.Color(0x4de8ff) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        uniform float uFlash;
        uniform vec3 uTop;
        uniform vec3 uHorizon;
        uniform vec3 uBottom;
        uniform float uFracture;
        uniform vec3 uMagenta;
        uniform vec3 uCyan;
        void main() {
          float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 col = mix(uBottom, uHorizon, smoothstep(0.0, 0.45, h));
          col = mix(col, uTop, smoothstep(0.4, 1.0, h));
          float band = sin(vDir.x * 8.0 + vDir.z * 5.0) * 0.5 + 0.5;
          col += vec3(0.02, 0.03, 0.05) * band * (1.0 - h) * 0.6;
          col += vec3(0.55, 0.65, 0.9) * uFlash * smoothstep(0.2, 0.9, h);
          col = mix(col, mix(uCyan, uMagenta, 0.45) * 0.15, uFracture * 0.35 * h);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), this.skyMat);
    skyDome.frustumCulled = false;
    this.scene.add(skyDome);
  }

  private addVolumetricShafts(): void {
    const shaftVert = /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    const shaftFrag = /* glsl */ `
      varying vec2 vUv;
      uniform float uOpacity;
      uniform vec3 uColor;
      uniform float uTime;
      void main() {
        float soft = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
        float fall = pow(1.0 - vUv.y, 1.4);
        float shimmer = 0.85 + 0.15 * sin(uTime * 0.7 + vUv.y * 6.0);
        float a = soft * fall * uOpacity * shimmer;
        gl_FragColor = vec4(uColor * a, a);
      }
    `;

    const shaftGroup = new THREE.Group();
    const placements: Array<{ x: number; z: number; rot: number; h: number; w: number; warm: boolean }> = [
      { x: -72, z: 380, rot: 0.15, h: 280, w: 28, warm: false },
      { x: 78, z: 340, rot: -0.2, h: 320, w: 32, warm: true },
      { x: -85, z: 240, rot: 0.1, h: 260, w: 24, warm: false },
      { x: 90, z: 180, rot: -0.12, h: 300, w: 30, warm: false },
      { x: -70, z: 110, rot: 0.08, h: 240, w: 22, warm: true },
      { x: 75, z: 50, rot: -0.18, h: 270, w: 26, warm: false },
      { x: -95, z: -20, rot: 0.22, h: 220, w: 20, warm: false },
      { x: 88, z: -60, rot: -0.1, h: 250, w: 24, warm: false },
    ];

    for (const p of placements) {
      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: {
          uOpacity: { value: p.warm ? 0.055 : 0.04 },
          uColor: { value: new THREE.Color(p.warm ? 0xffc090 : 0xa8c4e0) },
          uTime: { value: 0 },
        },
        vertexShader: shaftVert,
        fragmentShader: shaftFrag,
      });
      this.shaftMats.push(mat);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), mat);
      mesh.position.set(p.x, p.h * 0.45, p.z);
      mesh.rotation.y = p.rot;
      shaftGroup.add(mesh);

      const mesh2 = new THREE.Mesh(new THREE.PlaneGeometry(p.w * 0.85, p.h), mat);
      mesh2.position.copy(mesh.position);
      mesh2.rotation.y = p.rot + Math.PI / 2;
      shaftGroup.add(mesh2);
    }
    this.cityRoot.add(shaftGroup);
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
    return this.fractureRim;
  }

  update(
    time: number,
    knobs: {
      fracture: number;
      core: number;
      silence: number;
      finale: number;
      gravity: number;
      dissolve: number;
    },
    corePos: THREE.Vector3
  ): void {
    this.nextLightning -= 1 / 60;
    if (this.doubleFlashAt > 0 && time >= this.doubleFlashAt) {
      this.cloudFlashTarget = 0.4 + Math.random() * 0.5;
      this.doubleFlashAt = -1;
    }
    if (this.nextLightning <= 0 && knobs.fracture < 0.25 && knobs.finale < 0.1) {
      this.cloudFlashTarget = 0.55 + Math.random() * 0.7;
      this.nextLightning = 3.5 + Math.random() * 7;
      if (Math.random() > 0.55) {
        this.doubleFlashAt = time + 0.08 + Math.random() * 0.12;
      }
    }
    this.cloudFlashTarget *= 0.92;
    this.cloudFlash += (this.cloudFlashTarget - this.cloudFlash) * 0.35;
    this.skyMat.uniforms.uFlash.value = this.cloudFlash;
    this.skyMat.uniforms.uFracture.value = knobs.fracture;

    this.hemi.intensity = 0.55 - knobs.fracture * 0.15 - knobs.silence * 0.35 + knobs.finale * 0.1;
    this.key.intensity = 0.38 - knobs.silence * 0.25;
    this.fill.intensity = 0.14 + knobs.fracture * 0.08;
    this.bounce.intensity = 0.18 * (1 - knobs.finale * 0.8);

    this.fractureRim.intensity = knobs.fracture * 2.2 + knobs.core * 4.8;
    this.fractureRim.position.copy(corePos);
    this.fractureCyan.intensity = knobs.fracture * 1.4 + knobs.core * 2.2 + knobs.gravity * 0.6;
    this.fractureCyan.position.set(corePos.x + 35, corePos.y + 25, corePos.z + 40);
    this.cyanWash.intensity = 0.12 + knobs.fracture * 0.35;

    const streetMul = 1 - knobs.dissolve * 0.85 - knobs.finale * 0.9;
    for (let i = 0; i < this.streetLights.length; i++) {
      const L = this.streetLights[i];
      const base = (L.userData.base as number) ?? 0.5;
      const flicker =
        knobs.fracture > 0.2 ? 0.75 + 0.25 * Math.sin(time * 7 + i * 2.1) * knobs.fracture : 1;
      L.intensity = base * Math.max(0, streetMul) * flicker;
    }

    for (const m of this.shaftMats) {
      m.uniforms.uTime.value = time;
      const warm = m.uniforms.uColor.value.r > 0.8;
      m.uniforms.uOpacity.value =
        (warm ? 0.055 : 0.04) *
        (1 - knobs.finale * 0.9) *
        (1 - knobs.silence * 0.5) *
        (1 + this.cloudFlash * 0.8);
    }
  }
}
