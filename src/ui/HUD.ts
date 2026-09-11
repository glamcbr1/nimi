import type { PhaseDef } from '../timeline/states';

export class HUD {
  private root: HTMLElement;
  private sectionNum: HTMLElement;
  private sectionLabel: HTMLElement;
  private scrollHint: HTMLElement;
  private audioBtn: HTMLElement;
  private qualityBtn: HTMLElement;
  private finaleCard: HTMLElement;

  constructor() {
    this.root = document.getElementById('hud')!;
    this.sectionNum = document.getElementById('section-num')!;
    this.sectionLabel = document.getElementById('section-label')!;
    this.scrollHint = document.getElementById('scroll-hint')!;
    this.audioBtn = document.getElementById('btn-audio')!;
    this.qualityBtn = document.getElementById('btn-quality')!;
    this.finaleCard = document.getElementById('finale-card')!;
  }

  show(): void {
    this.root.classList.remove('hud--hidden');
  }

  setPhase(phase: PhaseDef): void {
    this.sectionNum.textContent = phase.num;
    this.sectionLabel.textContent = phase.label;
  }

  setAudio(on: boolean): void {
    this.audioBtn.textContent = on ? 'AUDIO ON' : 'AUDIO OFF';
  }

  setQuality(label: string): void {
    this.qualityBtn.textContent = label;
  }

  onAudio(cb: () => void): void {
    this.audioBtn.addEventListener('click', cb);
  }

  onQuality(cb: () => void): void {
    this.qualityBtn.addEventListener('click', cb);
  }

  updateProgress(p: number, finale: number): void {
    this.scrollHint.classList.toggle('is-hidden', p > 0.08);
    if (finale > 0.55) {
      this.finaleCard.classList.remove('finale-card--hidden');
      this.finaleCard.classList.add('is-visible');
    } else {
      this.finaleCard.classList.remove('is-visible');
    }
  }
}
