interface Voice {
  oscillator: OscillatorNode;
  gain: GainNode;
}

const MAX_VOICES = 24;

export class SoundEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private muted = false;
  private paused = false;
  private volume = 1;
  private readonly voices = new Set<Voice>();
  private readonly victoryTimers = new Set<number>();

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) this.clear();
  }

  setVolume(value: number): void { this.volume = Math.max(0, Math.min(1, value)); }

  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    if (paused) {
      this.clear();
      if (this.context) void this.context.suspend().catch(() => {});
    } else if (this.context) {
      void this.context.resume().catch(() => {});
    }
  }

  clear(): void {
    for (const timer of this.victoryTimers) window.clearTimeout(timer);
    this.victoryTimers.clear();
    for (const voice of this.voices) this.releaseVoice(voice, true);
  }

  destroy(): void {
    this.clear();
    this.masterGain?.disconnect();
    this.compressor?.disconnect();
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
    this.masterGain = null;
    this.compressor = null;
  }

  impact(strength = 1): void {
    this.tone(130 + strength * 42, 0.085, 'square', 0.075);
  }

  parry(): void {
    this.tone(720, 0.1, 'triangle', 0.06);
  }

  shot(): void {
    this.tone(310, 0.07, 'sawtooth', 0.05);
  }

  elimination(): void {
    this.tone(92, 0.28, 'sawtooth', 0.11, -45);
  }

  victory(): void {
    if (this.muted || this.paused) return;
    [392, 523, 659].forEach((frequency, index) => {
      const timer = window.setTimeout(() => {
        this.victoryTimers.delete(timer);
        this.tone(frequency, 0.22, 'triangle', 0.07);
      }, index * 120);
      this.victoryTimers.add(timer);
    });
  }

  private tone(frequency: number, duration: number, type: OscillatorType, volume: number, slide = 0): void {
    if (this.muted || this.paused || this.volume === 0 || this.voices.size >= MAX_VOICES) return;
    volume *= this.volume;
    let voice: Voice | undefined;
    try {
      this.ensureAudioGraph();
      const context = this.context as AudioContext;
      const masterGain = this.masterGain as GainNode;
      if (context.state === 'suspended') void context.resume().catch(() => {});
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      voice = { oscillator, gain };
      this.voices.add(voice);
      const activeVoice = voice;
      oscillator.onended = () => this.releaseVoice(activeVoice);
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, context.currentTime);
      oscillator.frequency.linearRampToValueAtTime(Math.max(30, frequency + slide), context.currentTime + duration);
      gain.gain.setValueAtTime(volume, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
      oscillator.connect(gain).connect(masterGain);
      oscillator.start();
      oscillator.stop(context.currentTime + duration);
    } catch {
      if (voice) this.releaseVoice(voice, true);
      this.muted = true;
    }
  }

  private releaseVoice(voice: Voice, stop = false): void {
    if (!this.voices.delete(voice)) return;
    voice.oscillator.onended = null;
    if (stop) {
      try { voice.oscillator.stop(); } catch { /* Already stopped or not started. */ }
    }
    voice.oscillator.disconnect();
    voice.gain.disconnect();
  }

  private ensureAudioGraph(): void {
    if (this.context) return;
    this.context = new AudioContext();
    this.masterGain = this.context.createGain();
    this.compressor = this.context.createDynamicsCompressor();
    this.masterGain.gain.value = 5.5;
    this.compressor.threshold.value = -8;
    this.compressor.knee.value = 8;
    this.compressor.ratio.value = 8;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.18;
    this.masterGain.connect(this.compressor).connect(this.context.destination);
  }
}
