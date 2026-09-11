import * as THREE from 'three';
import {
  EffectComposer,
  EffectPass,
  RenderPass,
  BloomEffect,
  VignetteEffect,
  NoiseEffect,
  ToneMappingEffect,
  ToneMappingMode,
  BrightnessContrastEffect,
  HueSaturationEffect,
} from 'postprocessing';
import type { QualitySettings } from '../utils/quality';

export class PostProcessingManager {
  readonly composer: EffectComposer;
  private bloom: BloomEffect;
  private vignette: VignetteEffect;
  private noise: NoiseEffect;
  private grade: HueSaturationEffect;
  private contrast: BrightnessContrastEffect;
  private baseBloom = 0.32;
  private enabled: boolean;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer, {
      frameBufferType: THREE.HalfFloatType,
    });
    this.composer.addPass(new RenderPass(scene, camera));

    // Restrained bloom — bright windows / skyways / core only
    this.bloom = new BloomEffect({
      intensity: 0.32,
      luminanceThreshold: 0.58,
      luminanceSmoothing: 0.32,
      mipmapBlur: true,
    });
    this.vignette = new VignetteEffect({ darkness: 0.55, offset: 0.34 });
    this.noise = new NoiseEffect({ premultiply: true });
    this.noise.blendMode.opacity.value = 0.12;
    this.grade = new HueSaturationEffect({ saturation: -0.12, hue: 0 });
    this.contrast = new BrightnessContrastEffect({ brightness: -0.025, contrast: 0.12 });
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });

    this.composer.addPass(
      new EffectPass(camera, this.bloom, this.contrast, this.grade, this.vignette, this.noise, tone)
    );
    this.enabled = true;
  }

  applyQuality(q: QualitySettings): void {
    this.enabled = true;
    this.baseBloom = q.bloom ? 0.32 : 0.0;
    this.bloom.intensity = this.baseBloom;
    this.noise.blendMode.opacity.value = q.bloom ? 0.12 : 0.07;
  }

  setSize(w: number, h: number): void {
    this.composer.setSize(w, h);
  }

  update(knobs: {
    distort: number;
    grade: number;
    core: number;
    silence: number;
    finale: number;
    fracture: number;
  }): void {
    this.bloom.intensity = this.baseBloom * (0.8 + knobs.core * 1.05 + knobs.fracture * 0.28);
    // Raise threshold early so only windows/skyways bloom — not mush
    if (knobs.core > 0.3) {
      this.bloom.luminanceMaterial.threshold = 0.48;
    } else if (knobs.fracture > 0.2) {
      this.bloom.luminanceMaterial.threshold = 0.52;
    } else {
      this.bloom.luminanceMaterial.threshold = 0.6;
    }

    this.vignette.darkness = 0.5 + knobs.silence * 0.32 + knobs.finale * 0.1;
    this.noise.blendMode.opacity.value = 0.09 + knobs.distort * 0.16 + knobs.silence * 0.07;

    // Color grade arc: cold teal shadows / warm practicals → cyan-magenta fracture → desat silence → surreal finale
    if (knobs.finale > 0.2) {
      this.grade.saturation = -0.02 + knobs.finale * 0.12;
      this.grade.hue = 0.02;
      this.contrast.contrast = 0.14;
      this.contrast.brightness = -0.03;
    } else if (knobs.silence > 0.2) {
      this.grade.saturation = -0.4 - knobs.silence * 0.28;
      this.grade.hue = 0;
      this.contrast.contrast = 0.04;
      this.contrast.brightness = -0.12;
    } else if (knobs.fracture > 0.15 || knobs.core > 0.1) {
      this.grade.saturation = 0.02 + knobs.fracture * 0.1;
      this.grade.hue = knobs.fracture * 0.04 - knobs.core * 0.02;
      this.contrast.contrast = 0.12 + knobs.distort * 0.06;
      this.contrast.brightness = -0.015;
    } else {
      // Early: cold teal shadows, slightly desaturated — film still
      this.grade.saturation = -0.14;
      this.grade.hue = -0.015; // pull toward teal
      this.contrast.contrast = 0.11;
      this.contrast.brightness = -0.028;
    }
  }

  render(delta: number): void {
    this.composer.render(delta);
  }
}
