import { expect, it } from 'vitest';
import { findFreePosition, fits } from './placement';
import { SeededRandom } from '../utils/seededRandom';

it('conserva una aparición válida y desplaza una invocación nueva fuera de una torreta sólida', () => {
  const preferred = { x: 120, y: 120, angle: 0.8 };
  expect(findFreePosition(preferred, 18, 34, 600, [])).toEqual(preferred);
  const obstacles = [{ x: 120, y: 120, radius: 25 }, { x: 170, y: 120, radius: 29 }];
  const result = findFreePosition(preferred, 18, 34, 600, obstacles)!;
  expect(fits(result, 18, 34, 600, obstacles)).toBe(true);
  expect(result).toEqual(findFreePosition(preferred, 18, 34, 600, obstacles));
});

it('busca un hueco más allá de una esquina ocupada sin mover unidades existentes', () => {
  const obstacles = Array.from({ length: 16 }, (_, i) => ({ x: 70 + i % 4 * 52, y: 70 + Math.floor(i / 4) * 52, radius: 25 }));
  const before = structuredClone(obstacles);
  const result = findFreePosition({ x: 60, y: 60, angle: 1 }, 18, 34, 600, obstacles)!;
  expect(fits(result, 18, 34, 600, obstacles)).toBe(true);
  expect(obstacles).toEqual(before);
});

it('declara la falta de espacio sin inventar un solapamiento o una desaparición', () => {
  expect(findFreePosition({ x: 50, y: 50, angle: 0 }, 18, 34, 100, [])).toBeUndefined();
  expect(findFreePosition({ x: 60, y: 60, angle: 0 }, 18, 34, 120, [{ x: 60, y: 60, radius: 25 }])).toBeUndefined();
});

it('el índice espacial no omite obstáculos grandes ni los que cruzan bordes de celda', () => {
  const random = new SeededRandom('placement-grid');
  for (let run = 0; run < 25; run += 1) {
    const occupants = Array.from({ length: 50 }, () => ({ x: random.between(30, 570), y: random.between(30, 570), radius: random.between(10, 70) }));
    const preferred = { x: random.between(30, 570), y: random.between(30, 570), angle: random.between(0, Math.PI * 2) };
    const result = findFreePosition(preferred, 18, 34, 600, occupants);
    if (result) expect(fits(result, 18, 34, 600, occupants)).toBe(true);
  }
});
