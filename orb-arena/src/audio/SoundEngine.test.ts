import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundEngine } from './SoundEngine';

function audioParam() {
  return {
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
}

class FakeNode {
  connect = vi.fn((destination: FakeNode) => destination);
  disconnect = vi.fn();
}

class FakeGain extends FakeNode {
  gain = audioParam();
}

class FakeOscillator extends FakeNode {
  type = '';
  frequency = audioParam();
  onended: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
}

const contexts: FakeAudioContext[] = [];

class FakeAudioContext {
  state: AudioContextState = 'running';
  currentTime = 10;
  destination = new FakeNode();
  oscillators: FakeOscillator[] = [];
  gains: FakeGain[] = [];
  compressor = Object.assign(new FakeNode(), {
    threshold: audioParam(), knee: audioParam(), ratio: audioParam(),
    attack: audioParam(), release: audioParam(),
  });
  resume = vi.fn(async () => { this.state = 'running'; });
  suspend = vi.fn(async () => { this.state = 'suspended'; });
  close = vi.fn(async () => { this.state = 'closed'; });

  constructor() { contexts.push(this); }

  createOscillator(): FakeOscillator {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  }

  createGain(): FakeGain {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }

  createDynamicsCompressor() { return this.compressor; }
}

describe('SoundEngine lifecycle', () => {
  let audio: SoundEngine;

  beforeEach(() => {
    contexts.length = 0;
    vi.useFakeTimers();
    vi.stubGlobal('window', { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout });
    vi.stubGlobal('AudioContext', FakeAudioContext);
    audio = new SoundEngine();
  });

  afterEach(() => {
    audio.destroy();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('creates audio lazily and preserves the existing tones and volume', () => {
    expect(contexts).toHaveLength(0);
    audio.impact(2);
    audio.parry();
    audio.shot();
    audio.elimination();

    const context = contexts[0]!;
    expect(contexts).toHaveLength(1);
    expect(context.gains[0]!.gain.value).toBe(5.5);
    expect(context.compressor.threshold.value).toBe(-8);
    expect(context.compressor.knee.value).toBe(8);
    expect(context.compressor.ratio.value).toBe(8);
    expect(context.compressor.attack.value).toBe(0.003);
    expect(context.compressor.release.value).toBe(0.18);
    const expectedTones = [
      { frequency: 214, duration: 0.085, type: 'square', volume: 0.075, endFrequency: 214 },
      { frequency: 720, duration: 0.1, type: 'triangle', volume: 0.06, endFrequency: 720 },
      { frequency: 310, duration: 0.07, type: 'sawtooth', volume: 0.05, endFrequency: 310 },
      { frequency: 92, duration: 0.28, type: 'sawtooth', volume: 0.11, endFrequency: 47 },
    ];
    expectedTones.forEach((tone, index) => {
      const oscillator = context.oscillators[index]!;
      const gain = context.gains[index + 1]!;
      expect(oscillator.type).toBe(tone.type);
      expect(oscillator.frequency.setValueAtTime).toHaveBeenCalledWith(tone.frequency, 10);
      expect(oscillator.frequency.linearRampToValueAtTime).toHaveBeenCalledWith(tone.endFrequency, 10 + tone.duration);
      expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(tone.volume, 10);
      expect(oscillator.stop).toHaveBeenCalledWith(10 + tone.duration);
    });
  });

  it('bounds overlapping voices and releases their nodes when playback ends', () => {
    for (let index = 0; index < 100; index += 1) audio.impact();
    const context = contexts[0]!;
    expect(context.oscillators).toHaveLength(24);
    const firstVoice = context.oscillators[0]!;
    firstVoice.onended!();
    expect(firstVoice.disconnect).toHaveBeenCalledOnce();
    expect(context.gains[1]!.disconnect).toHaveBeenCalledOnce();
    expect(firstVoice.onended).toBeNull();
    audio.shot();
    expect(context.oscillators).toHaveLength(25);
  });

  it('clears active voices and pending victory notes before restarting', () => {
    audio.victory();
    vi.advanceTimersByTime(0);
    const context = contexts[0]!;
    expect(context.oscillators).toHaveLength(1);
    audio.clear();
    expect(vi.getTimerCount()).toBe(0);
    expect(context.oscillators[0]!.stop).toHaveBeenLastCalledWith();
    expect(context.oscillators[0]!.disconnect).toHaveBeenCalledOnce();
    expect(context.gains[1]!.disconnect).toHaveBeenCalledOnce();
    vi.runAllTimers();
    expect(context.oscillators).toHaveLength(1);
    audio.shot();
    expect(context.oscillators).toHaveLength(2);
    expect(contexts).toHaveLength(1);
  });

  it('plays the original victory sequence when it is not interrupted', () => {
    audio.victory();
    vi.advanceTimersByTime(0);
    const context = contexts[0]!;
    expect(context.oscillators).toHaveLength(1);
    vi.advanceTimersByTime(119);
    expect(context.oscillators).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(context.oscillators).toHaveLength(2);
    vi.advanceTimersByTime(120);
    expect(context.oscillators).toHaveLength(3);
    [392, 523, 659].forEach((frequency, index) => {
      expect(context.oscillators[index]!.frequency.setValueAtTime).toHaveBeenCalledWith(frequency, 10);
      expect(context.gains[index + 1]!.gain.setValueAtTime).toHaveBeenCalledWith(0.07, 10);
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('suspends and clears audio while paused, then allows new sounds on resume', () => {
    audio.impact();
    audio.victory();
    const context = contexts[0]!;
    audio.setPaused(true);
    expect(context.suspend).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    audio.shot();
    audio.victory();
    vi.runAllTimers();
    expect(context.oscillators).toHaveLength(1);
    audio.setPaused(false);
    expect(context.resume).toHaveBeenCalledOnce();
    audio.shot();
    expect(context.oscillators).toHaveLength(2);
  });

  it('does not create a context when paused or muted before the first sound', () => {
    audio.setPaused(true);
    audio.impact();
    audio.victory();
    expect(contexts).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
    audio.setPaused(false);
    audio.setMuted(true);
    audio.shot();
    audio.victory();
    expect(contexts).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
    audio.setMuted(false);
    audio.shot();
    expect(contexts).toHaveLength(1);
  });

  it('muting cancels notes already queued or playing', () => {
    audio.impact();
    audio.victory();
    audio.setMuted(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(contexts[0]!.oscillators[0]!.disconnect).toHaveBeenCalledOnce();
  });

  it('destroys the graph and can initialize it again for a later scene', () => {
    audio.impact();
    audio.victory();
    const context = contexts[0]!;
    audio.destroy();
    audio.destroy();
    expect(context.close).toHaveBeenCalledOnce();
    expect(context.gains[0]!.disconnect).toHaveBeenCalledOnce();
    expect(context.compressor.disconnect).toHaveBeenCalledOnce();
    expect(context.oscillators[0]!.disconnect).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    audio.impact();
    expect(contexts).toHaveLength(2);
  });

  it('handles rejected context lifecycle requests without interrupting the game', async () => {
    audio.impact();
    const context = contexts[0]!;
    context.suspend.mockRejectedValueOnce(new Error('Unavailable'));
    context.resume.mockRejectedValueOnce(new Error('Unavailable'));
    context.close.mockRejectedValueOnce(new Error('Unavailable'));
    audio.setPaused(true);
    audio.setPaused(false);
    audio.destroy();
    await Promise.resolve();
    expect(context.close).toHaveBeenCalledOnce();
  });
});
