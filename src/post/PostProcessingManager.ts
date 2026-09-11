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
  private enabled: boolean;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer, {
      frameBufferType: THREE.HalfFloatType,
    });
    this.composer.addPass(new RenderPass(scene, camera));

    this.bloom = new BloomEffect({
      intensity: 0.35,
      luminanceThreshold: 0.55,
      luminanceSmoothing: 0.3,
      mipmapBlur: true,
    });
    this.vignette = new VignetteEffect({ darkness: 0.55, offset: 0.35 });
    this.noise = new NoiseEffect({ premultiply: true });
    this.noise.blendMode.opacity.value = 0.18;
    this.grade = new HueSaturationEffect({ saturation: -0.08, hue: 0 });
    this.contrast = new BrightnessContrastEffect({ brightness: -0.02, contrast: 0.08 });
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });

    this.composer.addPass(
      new EffectPass(camera, this.bloom, this.contrast, this.grade, this.vignette, this.noise, tone)
    );
    this.enabled = true;
  }

  applyQuality(q: QualitySettings): void {
    this.enabled = true;
    this.bloom.intensity = q.bloom ? 0.35 : 0.0;
    this.noise.blendMode.opacity.value = q.bloom ? 0.18 : 0.1;
  }

  setSize(w: number, h: number): void {
    this.composer.setSize(w, h);
  }

  update(knobs: { distort: number; grade: number; core: number; silence: number; finale: number }): void {
    this.bloom.intensity = 0.25 + knobs.core * 0.55 + knobs.distort * 0.15;
    this.vignette.darkness = 0.5 + knobs.silence * 0.25 + knobs.finale * 0.1;
    this.noise.blendMode.opacity.value = 0.12 + knobs.distort * 0.2;
    // Cool → hot → space
    this.grade.saturation = -0.05 - knobs.finale * 0.1 + knobs.core * 0.05;
    this.contrast.contrast = 0.06 + knobs.distort * 0.08;
    this.contrast.brightness = -0.02 - knobs.silence * 0.08;
  }

  render(delta: number): void {
    this.composer.render(delta);
  }
}
