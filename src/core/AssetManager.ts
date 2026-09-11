/** Lightweight progress tracker — city is procedural, no heavy assets */
export class AssetManager {
  private progress = 0;
  private listeners: Array<(p: number) => void> = [];

  onProgress(cb: (p: number) => void): void {
    this.listeners.push(cb);
  }

  set(p: number): void {
    this.progress = Math.max(this.progress, Math.min(1, p));
    for (const cb of this.listeners) cb(this.progress);
  }

  async bootSequence(steps: Array<() => Promise<void> | void>): Promise<void> {
    const n = steps.length;
    for (let i = 0; i < n; i++) {
      await steps[i]();
      this.set((i + 1) / n);
      await new Promise((r) => setTimeout(r, 80));
    }
    this.set(1);
  }
}
