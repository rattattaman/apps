import { describe, expect, it } from 'vitest';
import { FixedStepClock } from './FixedStepClock';

describe('reloj de simulación', () => {
  it.each([0.5, 1, 2])('misma secuencia a 30/60/144 FPS con velocidad %s', (speed) => {
    const sequences = [30, 60, 144].map((fps) => {
      const clock = new FixedStepClock();
      const ticks: number[] = [];
      for (let frame = 0; frame < fps * 10; frame += 1) clock.advance(1000 / fps, speed, (now) => ticks.push(now));
      return ticks;
    });
    expect(sequences[0]).toEqual(sequences[1]);
    expect(sequences[1]).toEqual(sequences[2]);
    expect(sequences[0]).toHaveLength(600 * speed);
  });

  it('retiene el tiempo pendiente de un fotograma lento y no salta reglas', () => {
    const clock = new FixedStepClock();
    let count = 0;
    const tick = () => { count += 1; };
    expect(clock.advance(1000, 1, tick)).toBe(8);
    expect(clock.pendingMs).toBeGreaterThan(800);
    while (clock.pendingMs > 0.001) clock.advance(0, 1, tick);
    expect(count).toBe(60);
    expect(clock.now).toBeCloseTo(1000);
  });

  it('pausa y reinicio no arrastran tiempo ni aceptan deltas inválidos', () => {
    const clock = new FixedStepClock();
    clock.advance(1000, 0, () => { throw new Error('paused'); });
    clock.advance(NaN, 1, () => { throw new Error('invalid'); });
    clock.advance(-1, 1, () => { throw new Error('invalid'); });
    expect(clock.now).toBe(0);
    clock.advance(1000, 1, () => {});
    clock.reset();
    expect(clock.now).toBe(0);
    expect(clock.pendingMs).toBe(0);
  });
});
