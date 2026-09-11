import { PHASES } from '../timeline/states';
import type { TimelineManager } from '../timeline/TimelineManager';
import type { PerformanceManager } from '../core/PerformanceManager';

export class DebugTools {
  private panel: HTMLDivElement | null = null;
  private timeline: TimelineManager;
  private perf: PerformanceManager;

  constructor(timeline: TimelineManager, perf: PerformanceManager) {
    this.timeline = timeline;
    this.perf = perf;
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') === '1') this.mount();
  }

  private mount(): void {
    this.panel = document.createElement('div');
    this.panel.className = 'debug-panel';
    this.panel.innerHTML = `<h3>DEBUG</h3>
      <div id="dbg-fps">FPS: --</div>
      <div id="dbg-prog">Progress: 0.00</div>
      <label>Scrub</label>
      <input id="dbg-scrub" type="range" min="0" max="1000" value="0" />
      <label>Phase jumps</label>`;
    for (const phase of PHASES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = `${phase.num} ${phase.label}`;
      btn.addEventListener('click', () => {
        this.timeline.setProgress(phase.start + 0.005, true);
      });
      this.panel.appendChild(btn);
    }
    document.body.appendChild(this.panel);
    const scrub = this.panel.querySelector('#dbg-scrub') as HTMLInputElement;
    scrub.addEventListener('input', () => {
      this.timeline.setProgress(Number(scrub.value) / 1000, true);
    });
  }

  update(progress: number): void {
    if (!this.panel) return;
    const fps = this.panel.querySelector('#dbg-fps');
    const prog = this.panel.querySelector('#dbg-prog');
    if (fps) fps.textContent = `FPS: ${this.perf.getFps().toFixed(0)} | ${this.perf.level}`;
    if (prog) prog.textContent = `Progress: ${progress.toFixed(3)} | ${this.timeline.getPhase().id}`;
  }
}
