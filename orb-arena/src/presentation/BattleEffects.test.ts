import { expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { SeededRandom } from '../utils/seededRandom';
import { BattleEffects } from './BattleEffects';

it('efectos ocultos y saturados conservan exactamente el azar de la simulación', () => {
  const draws: number[] = [];
  for (const enabled of [true, false]) {
    const rng = new SeededRandom('particles-regression');
    const shape = { setDepth: vi.fn().mockReturnThis(), destroy: vi.fn() };
    const circle = vi.fn(() => shape);
    const scene = { add: { circle }, tweens: { add: vi.fn() } };
    const effects = new BattleEffects(scene as unknown as Phaser.Scene, rng);
    effects.spark(0, 0, 0xff0000, 400, enabled);
    expect(circle).toHaveBeenCalledTimes(enabled ? 200 : 0);
    expect(effects.activeParticles).toBe(enabled ? 200 : 0);
    draws.push(rng.next());
  }
  expect(draws[0]).toBe(draws[1]);
  const original = new SeededRandom('particles-regression');
  for (let i = 0; i < 400 * 4; i += 1) original.next();
  expect(draws[0]).toBe(original.next());
});
