export class SoundEngine {
  private context: AudioContext | null = null;
  private muted = false;

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  impact(strength = 1): void {
    this.tone(130 + strength * 42, 0.045, 'square', 0.025);
  }

  parry(): void {
    this.tone(720, 0.055, 'triangle', 0.018);
  }

  shot(): void {
    this.tone(310, 0.035, 'sawtooth', 0.012);
  }

  elimination(): void {
    this.tone(92, 0.2, 'sawtooth', 0.034, -45);
  }

  victory(): void {
    [392, 523, 659].forEach((frequency, index) => {
      window.setTimeout(() => this.tone(frequency, 0.16, 'triangle', 0.025), index * 105);
    });
  }

  private tone(frequency: number, duration: number, type: OscillatorType, volume: number, slide = 0): void {
    if (this.muted) return;
    try {
      this.context ??= new AudioContext();
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, this.context.currentTime);
      oscillator.frequency.linearRampToValueAtTime(Math.max(30, frequency + slide), this.context.currentTime + duration);
      gain.gain.setValueAtTime(volume, this.context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + duration);
      oscillator.connect(gain).connect(this.context.destination);
      oscillator.start();
      oscillator.stop(this.context.currentTime + duration);
    } catch {
      this.muted = true;
    }
  }
}
