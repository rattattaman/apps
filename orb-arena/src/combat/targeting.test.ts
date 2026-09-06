import { expect, it } from 'vitest';
import { nearestTarget } from './targeting';
import { SeededRandom } from '../utils/seededRandom';

it('conserva el objetivo del algoritmo anterior, incluidos empates y muertos', () => {
  const random = new SeededRandom('targeting-regression');
  const candidates = Array.from({ length: 200 }, () => ({ x: random.integer(0, 20), y: random.integer(0, 20), alive: random.next() > 0.2 }));
  for (const source of candidates) {
    const before = candidates.filter((c) => c !== source && c.alive)
      .sort((a, b) => (a.x - source.x) ** 2 + (a.y - source.y) ** 2 - (b.x - source.x) ** 2 - (b.y - source.y) ** 2)[0];
    expect(nearestTarget(source, candidates)).toBe(before);
  }
});

it('permite filtrar impactos del láser sin alterar el orden y devuelve undefined sin rivales', () => {
  const source = { x: 0, y: 0, alive: true };
  const a = { x: 1, y: 0, alive: true };
  const b = { x: -1, y: 0, alive: true };
  expect(nearestTarget(source, [source, a, b])).toBe(a);
  expect(nearestTarget(source, [source, a, b], (c) => c.x < 0)).toBe(b);
  expect(nearestTarget(source, [source])).toBeUndefined();
});
