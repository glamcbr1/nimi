export class LoadingScreen {
  private root: HTMLElement;
  private fill: HTMLElement;
  private pct: HTMLElement;
  private lines: NodeListOf<HTMLElement>;

  constructor() {
    this.root = document.getElementById('loader')!;
    this.fill = document.getElementById('loader-fill')!;
    this.pct = document.getElementById('loader-pct')!;
    this.lines = this.root.querySelectorAll('.loader__line');
  }

  setProgress(p: number): void {
    const pct = Math.floor(p * 100);
    this.fill.style.width = `${pct}%`;
    this.pct.textContent = `${pct.toString().padStart(2, '0')}%`;
    const active = Math.min(this.lines.length - 1, Math.floor(p * this.lines.length));
    this.lines.forEach((line, i) => {
      line.classList.toggle('is-active', i === active);
      line.classList.toggle('is-done', i < active);
    });
  }

  async hide(): Promise<void> {
    this.setProgress(1);
    await new Promise((r) => setTimeout(r, 400));
    this.root.classList.add('is-done');
  }
}
