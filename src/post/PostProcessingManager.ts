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
  private baseBloom = 0.28;
  private enabled: boolean;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer, {
      frameBufferType: THREE.HalfFloatType,
    });
    this.composer.addPass(new RenderPass(scene, camera));

    // Restrained bloom — not glow soup
    this.bloom = new BloomEffect({
      intensity: 0.28,
      luminanceThreshold: 0.62,
      luminanceSmoothing: 0.35,
      mipmapBlur: true,
    });
    this.vignette = new VignetteEffect({ darkness: 0.58, offset: 0.32 });
    this.noise = new NoiseEffect({ premultiply: true });
    this.noise.blendMode.opacity.value = 0.14;
    this.grade = new HueSaturationEffect({ saturation: -0.1, hue: 0 });
    this.contrast = new BrightnessContrastEffect({ brightness: -0.03, contrast: 0.1 });
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });

    this.composer.addPass(
      new EffectPass(camera, this.bloom, this.contrast, this.grade, this.vignette, this.noise, tone)
    );
    this.enabled = true;
  }

  applyQuality(q: QualitySettings): void {
    this.enabled = true;
    this.baseBloom = q.bloom ? 0.28 : 0.0;
    this.bloom.intensity = this.baseBloom;
    this.noise.blendMode.opacity.value = q.bloom ? 0.14 : 0.08;
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
    // Bloom: restrained, peaks at core emissives only
    this.bloom.intensity = this.baseBloom * (0.85 + knobs.core * 0.9 + knobs.fracture * 0.25);

    this.vignette.darkness = 0.52 + knobs.silence * 0.3 + knobs.finale * 0.12;
    this.noise.blendMode.opacity.value = 0.1 + knobs.distort * 0.18 + knobs.silence * 0.08;

    // Color grade arc: cold → cyan/magenta fracture → near-monochrome silence → surreal finale
    if (knobs.finale > 0.2) {
      this.grade.saturation = -0.05 + knobs.finale * 0.15;
      this.contrast.contrast = 0.12;
      this.contrast.brightness = -0.04;
    } else if (knobs.silence > 0.2) {
      this.grade.saturation = -0.35 - knobs.silence * 0.25;
      this.contrast.contrast = 0.05;
      this.contrast.brightness = -0.1;
    } else if (knobs.fracture > 0.15 || knobs.core > 0.1) {
      this.grade.saturation = -0.02 + knobs.fracture * 0.08;
      this.contrast.contrast = 0.1 + knobs.distort * 0.06;
      this.contrast.brightness = -0.02;
    } else {
      this.grade.saturation = -0.12;
      this.contrast.contrast = 0.08;
      this.contrast.brightness = -0.03;
    }
  }

  render(delta: number): void {
    this.composer.render(delta);
  }
}
