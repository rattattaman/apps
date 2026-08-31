export class SoundEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private muted = false;

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  impact(strength = 1): void {
    this.tone(130 + strength * 42, 0.045, 'square', 0.03);
  }

  parry(): void {
    this.tone(720, 0.055, 'triangle', 0.024);
  }

  shot(): void {
    this.tone(310, 0.035, 'sawtooth', 0.018);
  }

  elimination(): void {
    this.tone(92, 0.2, 'sawtooth', 0.045, -45);
  }

  victory(): void {
    [392, 523, 659].forEach((frequency, index) => {
      window.setTimeout(() => this.tone(frequency, 0.16, 'triangle', 0.032), index * 105);
    });
  }

  private tone(frequency: number, duration: number, type: OscillatorType, volume: number, slide = 0): void {
    if (this.muted) return;
    try {
      this.ensureAudioGraph();
      const context = this.context as AudioContext;
      const masterGain = this.masterGain as GainNode;
      if (context.state === 'suspended') void context.resume();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, context.currentTime);
      oscillator.frequency.linearRampToValueAtTime(Math.max(30, frequency + slide), context.currentTime + duration);
      gain.gain.setValueAtTime(volume, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
      oscillator.connect(gain).connect(masterGain);
      oscillator.start();
      oscillator.stop(context.currentTime + duration);
    } catch {
      this.muted = true;
    }
  }

  private ensureAudioGraph(): void {
    if (this.context) return;
    this.context = new AudioContext();
    this.masterGain = this.context.createGain();
    this.compressor = this.context.createDynamicsCompressor();
    this.masterGain.gain.value = 2.8;
    this.compressor.threshold.value = -12;
    this.compressor.knee.value = 10;
    this.compressor.ratio.value = 6;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.18;
    this.masterGain.connect(this.compressor).connect(this.context.destination);
  }
}
