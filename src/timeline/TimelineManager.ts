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
  private syncingScroll = false;

  constructor(proxy: HTMLElement) {
    this.proxy = proxy;
    this.phase = phaseAt(0);
    this.bind();
  }

  onUpdate(cb: (p: number, phase: PhaseDef) => void): void {
    this.listeners.push(cb);
  }

  private maxScroll(): number {
    return Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  }

  private bind(): void {
    document.documentElement.style.height = '1200vh';
    this.proxy.style.height = '1200vh';

    window.addEventListener(
      'scroll',
      () => {
        if (this.syncingScroll) return;
        this.target = clamp(window.scrollY / this.maxScroll(), 0, 1);
        this.scrolling = true;
      },
      { passive: true }
    );

    // Primary path on Mac trackpads / when overflow quirks block native scroll
    window.addEventListener(
      'wheel',
      (e) => {
        // If page can scroll natively, let it — scroll listener updates target.
        // If not (maxScroll tiny / locked), drive target from wheel directly.
        const max = this.maxScroll();
        const canNative = max > window.innerHeight * 0.5;
        if (canNative && !e.ctrlKey) {
          this.scrolling = true;
          return;
        }
        e.preventDefault();
        const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1);
        this.target = clamp(this.target + delta * 0.00055, 0, 1);
        this.scrolling = true;
        this.syncingScroll = true;
        window.scrollTo(0, this.target * max);
        this.syncingScroll = false;
      },
      { passive: false }
    );

    // Touch drag for trackpad-less / mobile
    let touchY = 0;
    window.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 1) touchY = e.touches[0].clientY;
      },
      { passive: true }
    );
    window.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length !== 1) return;
        const y = e.touches[0].clientY;
        const dy = touchY - y;
        touchY = y;
        this.target = clamp(this.target + dy * 0.0012, 0, 1);
        this.scrolling = true;
        this.syncingScroll = true;
        window.scrollTo(0, this.target * this.maxScroll());
        this.syncingScroll = false;
      },
      { passive: true }
    );

    // Keyboard fallback
    window.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 0.08 : 0.035;
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        this.setProgress(this.target + step, false);
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        this.setProgress(this.target - step, false);
      } else if (e.key === 'Home') {
        this.setProgress(0, true);
      } else if (e.key === 'End') {
        this.setProgress(1, true);
      }
    });
  }

  setProgress(p: number, immediate = false): void {
    this.target = clamp(p, 0, 1);
    if (immediate) {
      this.progress = this.target;
      this.syncingScroll = true;
      window.scrollTo(0, this.progress * this.maxScroll());
      this.syncingScroll = false;
      this.emit();
    } else {
      gsap.to(this, {
        progress: this.target,
        duration: 0.55,
        ease: 'power2.out',
        onUpdate: () => {
          this.syncingScroll = true;
          window.scrollTo(0, this.progress * this.maxScroll());
          this.syncingScroll = false;
          this.emit();
        },
      });
    }
  }

  update(_dt: number): void {
    const next = this.progress + (this.target - this.progress) * 0.1;
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
    // Progressive authored arc — large readable beats, not tiny jitters
    const fracture = easeInOutCubic(s(0.28, 0.52));
    const gravity = easeInOutCubic(s(0.40, 0.58));
    const fold = easeInOutCubic(s(0.48, 0.68));
    const ghost = easeInOutCubic(s(0.56, 0.76));
    const dissolve = easeInOutCubic(s(0.80, 0.92));
    const core = easeInOutCubic(s(0.70, 0.88));
    const silence = easeInOutCubic(s(0.89, 0.95));
    const finale = easeInOutCubic(s(0.93, 1.0));
    const distort = Math.max(fracture * 0.5, ghost * 0.8, dissolve);
    const grade = s(0.0, 0.4) * 0.2 + fracture * 0.6 + finale * 1.2;
    const rain = 1 - finale * 0.95;
    const trafficGlitch = Math.max(fracture, gravity, fold);
    return { fracture, gravity, fold, ghost, dissolve, core, silence, finale, distort, grade, rain, trafficGlitch };
  }
}
