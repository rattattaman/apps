// Original procedural composition for Orb Arena. No samples or third-party melodies.
export class ArcadeMusic {
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private timer: number | null = null;
  private step = 0;
  private nextAt = 0;
  private volume = .12;
  private nodes = new Set<OscillatorNode>();
  setVolume(value: number): void { this.volume = value; if (this.gain) this.gain.gain.value = value * 1.8; }
  start(): void {
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.gain = this.context.createGain();
        this.compressor = this.context.createDynamicsCompressor();
        this.compressor.threshold.value = -8;
        this.compressor.knee.value = 12;
        this.compressor.ratio.value = 12;
        this.compressor.attack.value = .003;
        this.compressor.release.value = .12;
        this.gain.connect(this.compressor);
        this.compressor.connect(this.context.destination);
        this.setVolume(this.volume);
      }
      void this.context.resume().catch(() => {});
      if (this.timer !== null) return;
      this.nextAt = this.context.currentTime;
      this.timer = window.setInterval(() => this.schedule(), 50);
      this.schedule();
    } catch { /* Audio unavailable */ }
  }
  pause(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    for (const node of this.nodes) { try { node.stop(); } catch {} }
    this.nodes.clear();
    if (this.context) void this.context.suspend().catch(() => {});
  }
  destroy(): void {
    this.pause(); this.gain?.disconnect(); this.compressor?.disconnect();
    if (this.context) void this.context.close().catch(() => {});
    this.context = null; this.gain = null; this.compressor = null;
  }
  private note(frequency: number, at: number, duration: number, type: OscillatorType, volume: number): void {
    const ctx = this.context!;
    if (this.nodes.size >= 16) return;
    const oscillator = ctx.createOscillator(), envelope = ctx.createGain();
    oscillator.type = type; oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0, at); envelope.gain.linearRampToValueAtTime(volume, at+.008);
    envelope.gain.exponentialRampToValueAtTime(.001, at+duration);
    oscillator.connect(envelope); envelope.connect(this.gain!);
    this.nodes.add(oscillator);
    oscillator.onended = () => { this.nodes.delete(oscillator); oscillator.disconnect(); envelope.disconnect(); };
    oscillator.start(at); oscillator.stop(at+duration+.02);
  }
  private schedule(): void {
    const ctx = this.context!;
    if (ctx.state !== 'running') return;
    this.nextAt = Math.max(this.nextAt, ctx.currentTime);
    const notes = [0,7,12,3,10,7,15,12,0,10,7,3,14,10,7,12];
    while (this.nextAt < ctx.currentTime+.12) {
      const n = this.step % 16, root = [130.81,116.54,155.56,98][Math.floor(this.step/32)%4]!;
      this.note(root * 2 ** (notes[n]!/12), this.nextAt, .13, 'triangle', .32);
      if (n%4 === 0) { this.note(root/2, this.nextAt, .22, 'sine', .65); this.note(55, this.nextAt, .09, 'sine', .7); }
      if (n%2 === 1) this.note(6400, this.nextAt, .025, 'square', .035);
      this.step++; this.nextAt += 60/124/4;
    }
  }
}
