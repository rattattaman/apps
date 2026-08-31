import { describe, expect, it } from 'vitest';
import { hashSeed, SeededRandom } from './seededRandom';

describe('SeededRandom', () => {
  it('repite exactamente una secuencia con la misma semilla', () => {
    const first = new SeededRandom('ARENA-42');
    const second = new SeededRandom('ARENA-42');
    expect(Array.from({ length: 10 }, () => first.next()))
      .toEqual(Array.from({ length: 10 }, () => second.next()));
  });

  it('separa semillas distintas', () => {
    expect(hashSeed('SOL')).not.toBe(hashSeed('VANTA'));
  });

  it('respeta los límites enteros', () => {
    const random = new SeededRandom('LIMITS');
    const values = Array.from({ length: 100 }, () => random.integer(2, 4));
    expect(values.every((value) => value >= 2 && value <= 4)).toBe(true);
  });
});
