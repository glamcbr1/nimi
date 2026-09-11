/** Procedural cinematic Web Audio layers — no external assets required */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private drones: OscillatorNode[] = [];
  private droneGains: GainNode[] = [];
  private noise: AudioBufferSourceNode | null = null;
  private noiseGain: GainNode | null = null;
  private pulse: OscillatorNode | null = null;
  private pulseGain: GainNode | null = null;
  private enabled = false;
  private started = false;

  async resume(): Promise<void> {
    if (!this.ctx) this.build();
    if (this.ctx!.state === 'suspended') await this.ctx!.resume();
    if (!this.started) {
      this.startLayers();
      this.started = true;
    }
    this.enabled = true;
    if (this.master) this.master.gain.setTargetAtTime(0.35, this.ctx!.currentTime, 0.2);
  }

  mute(): void {
    this.enabled = false;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
    }
  }

  toggle(): boolean {
    if (this.enabled) this.mute();
    else void this.resume();
    return this.enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private build(): void {
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // Soft filter
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;
    filter.connect(this.master);
    this._filter = filter;
  }

  private _filter: BiquadFilterNode | null = null;

  private startLayers(): void {
    const ctx = this.ctx!;
    const filter = this._filter!;

    const freqs = [55, 82.5, 110, 164.8];
    for (const f of freqs) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0.08;
      osc.connect(g);
      g.connect(filter);
      osc.start();
      this.drones.push(osc);
      this.droneGains.push(g);
    }

    // Noise bed (rain / atmosphere)
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
    this.noise = ctx.createBufferSource();
    this.noise.buffer = buffer;
    this.noise.loop = true;
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0.04;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 1800;
    noiseFilter.Q.value = 0.6;
    this.noise.connect(noiseFilter);
    noiseFilter.connect(this.noiseGain);
    this.noiseGain.connect(this.master!);
    this.noise.start();

    // Pulse / fracture heartbeat
    this.pulse = ctx.createOscillator();
    this.pulse.type = 'triangle';
    this.pulse.frequency.value = 40;
    this.pulseGain = ctx.createGain();
    this.pulseGain.gain.value = 0;
    this.pulse.connect(this.pulseGain);
    this.pulseGain.connect(this.master!);
    this.pulse.start();
  }

  update(knobs: {
    fracture: number;
    core: number;
    silence: number;
    finale: number;
    gravity: number;
  }): void {
    if (!this.ctx || !this.enabled || !this.started) return;
    const t = this.ctx.currentTime;
    const tension = Math.max(knobs.fracture, knobs.gravity, knobs.core);

    if (this._filter) {
      this._filter.frequency.setTargetAtTime(800 + tension * 2400 + knobs.finale * 600, t, 0.3);
    }
    if (this.noiseGain) {
      this.noiseGain.gain.setTargetAtTime(0.04 * (1 - knobs.silence) * (1 - knobs.finale * 0.7), t, 0.2);
    }
    if (this.pulseGain) {
      this.pulseGain.gain.setTargetAtTime(tension * 0.12 * (1 - knobs.silence), t, 0.1);
    }
    if (this.pulse) {
      this.pulse.frequency.setTargetAtTime(36 + knobs.core * 40, t, 0.2);
    }
    for (let i = 0; i < this.droneGains.length; i++) {
      const base = 0.06 + i * 0.015;
      const g = base * (1 - knobs.silence * 0.9) * (0.7 + knobs.finale * 0.5);
      this.droneGains[i].gain.setTargetAtTime(g, t, 0.3);
    }
    if (this.master) {
      const vol = knobs.silence > 0.8 ? 0.05 : 0.35;
      this.master.gain.setTargetAtTime(this.enabled ? vol : 0, t, 0.4);
    }
  }
}
