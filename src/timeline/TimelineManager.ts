import gsap from 'gsap';
import { phaseAt, type PhaseDef } from './states';
import { clamp, easeInOutCubic } from '../utils/math';

export class TimelineManager {
  progress = 0;
  private target = 0;
  private scrolling = false;
  private proxy: HTMLElement;
  private phase: PhaseDef;
  private listeners: Array<(p: number, phase: PhaseDef) => void> = [];

  constructor(proxy: HTMLElement) {
    this.proxy = proxy;
    this.phase = phaseAt(0);
    this.bind();
  }

  onUpdate(cb: (p: number, phase: PhaseDef) => void): void {
    this.listeners.push(cb);
  }

  private bind(): void {
    // Use window scroll with tall proxy for native feel
    document.documentElement.style.height = '1200vh';
    window.addEventListener(
      'scroll',
      () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        this.target = max > 0 ? window.scrollY / max : 0;
        this.scrolling = true;
      },
      { passive: true }
    );

    // Touch / wheel fallback smoothing via gsap
    window.addEventListener(
      'wheel',
      (e) => {
        // allow native scroll; just mark activity
        this.scrolling = true;
        void e;
      },
      { passive: true }
    );
  }

  setProgress(p: number, immediate = false): void {
    this.target = clamp(p, 0, 1);
    if (immediate) {
      this.progress = this.target;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, this.progress * max);
      this.emit();
    } else {
      gsap.to(this, {
        progress: this.target,
        duration: 0.6,
        ease: 'power2.out',
        onUpdate: () => this.emit(),
      });
    }
  }

  update(_dt: number): void {
    // Smooth toward scroll target
    const next = this.progress + (this.target - this.progress) * 0.08;
    if (Math.abs(next - this.progress) > 0.00001) {
      this.progress = next;
      this.emit();
    }
  }

  private emit(): void {
    this.phase = phaseAt(this.progress);
    for (const cb of this.listeners) cb(this.progress, this.phase);
  }

  getPhase(): PhaseDef {
    return this.phase;
  }

  /** Derived cinematic knobs from progress */
  getKnobs(): {
    fracture: number;
    gravity: number;
    fold: number;
    ghost: number;
    dissolve: number;
    core: number;
    silence: number;
    finale: number;
    distort: number;
    grade: number;
    rain: number;
    trafficGlitch: number;
  } {
    const p = this.progress;
    const s = (a: number, b: number) => clamp((p - a) / (b - a), 0, 1);
    const fracture = easeInOutCubic(s(0.30, 0.55));
    const gravity = easeInOutCubic(s(0.42, 0.58));
    const fold = easeInOutCubic(s(0.50, 0.68));
    const ghost = easeInOutCubic(s(0.58, 0.78));
    const dissolve = easeInOutCubic(s(0.82, 0.92));
    const core = easeInOutCubic(s(0.72, 0.88));
    const silence = easeInOutCubic(s(0.90, 0.95));
    const finale = easeInOutCubic(s(0.94, 1.0));
    const distort = Math.max(fracture * 0.5, ghost * 0.8, dissolve);
    const grade = s(0.0, 0.4) * 0.2 + fracture * 0.6 + finale * 1.2;
    const rain = 1 - finale * 0.95;
    const trafficGlitch = Math.max(fracture, gravity, fold);
    return { fracture, gravity, fold, ghost, dissolve, core, silence, finale, distort, grade, rain, trafficGlitch };
  }
}
