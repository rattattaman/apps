import { describe, expect, it } from 'vitest';
import { SeededRandom } from '../utils/seededRandom';
import { createChaosGravity } from './ChaosController';

describe('gravedad de Caos', () => {
  it('genera una fuerza claramente perceptible y determinista', () => {
    const first = createChaosGravity(new SeededRandom('GRAVITY'));
    const second = createChaosGravity(new SeededRandom('GRAVITY'));
    expect(first).toEqual(second);
    expect(Math.hypot(first.x, first.y)).toBeGreaterThanOrEqual(1.65);
  });
});
