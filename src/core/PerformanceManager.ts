import type { QualityLevel, QualitySettings } from '../utils/quality';
import { QUALITY_PRESETS, detectInitialQuality } from '../utils/quality';

export class PerformanceManager {
  level: QualityLevel;
  settings: QualitySettings;
  private frames = 0;
  private elapsed = 0;
  private fps = 60;
  private auto = true;
  private listeners: Array<(q: QualityLevel, s: QualitySettings) => void> = [];

  constructor() {
    this.level = detectInitialQuality();
    this.settings = { ...QUALITY_PRESETS[this.level] };
  }

  onChange(cb: (q: QualityLevel, s: QualitySettings) => void): void {
    this.listeners.push(cb);
  }

  setLevel(level: QualityLevel, auto = false): void {
    this.level = level;
    this.settings = { ...QUALITY_PRESETS[level] };
    this.auto = auto ? this.auto : false;
    for (const cb of this.listeners) cb(this.level, this.settings);
  }

  cycle(): QualityLevel {
    const order: QualityLevel[] = ['ULTRA', 'HIGH', 'MEDIUM', 'LOW'];
    const i = order.indexOf(this.level);
    const next = order[(i + 1) % order.length];
    this.setLevel(next);
    return next;
  }

  update(dt: number): void {
    this.frames++;
    this.elapsed += dt;
    if (this.elapsed >= 1.0) {
      this.fps = this.frames / this.elapsed;
      this.frames = 0;
      this.elapsed = 0;
      if (this.auto) this.adapt();
    }
  }

  private adapt(): void {
    if (this.fps < 28 && this.level !== 'LOW') {
      const order: QualityLevel[] = ['ULTRA', 'HIGH', 'MEDIUM', 'LOW'];
      const i = order.indexOf(this.level);
      if (i < order.length - 1) this.setLevel(order[i + 1], true);
    }
  }

  getFps(): number {
    return this.fps;
  }
}
