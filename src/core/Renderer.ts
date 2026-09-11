import * as THREE from 'three';
import type { QualitySettings } from '../utils/quality';

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
      depth: true,
    });
    this.renderer.setClearColor(0x03050c, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(1);
    this.resize();
  }

  applyQuality(q: QualitySettings): void {
    const dpr = Math.min(window.devicePixelRatio || 1, q.pixelRatioCap) * (q.dpr / Math.max(q.pixelRatioCap, 0.1));
    const capped = Math.min(window.devicePixelRatio || 1, q.pixelRatioCap);
    this.renderer.setPixelRatio(capped);
    this.renderer.toneMappingExposure = q.bloom ? 1.12 : 1.2;
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
  }

  getSize(): { width: number; height: number } {
    return { width: this.canvas.clientWidth, height: this.canvas.clientHeight };
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
