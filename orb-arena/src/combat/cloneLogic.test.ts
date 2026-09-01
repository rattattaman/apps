import { describe, expect, it } from 'vitest';
import { canCreateClone, cloneHealthForNumber } from './cloneLogic';

describe('mecánica de clones de Grimorio', () => {
  it('solo permite clonar al Grimorio original vivo', () => {
    expect(canCreateClone({ alive: true, isClone: false, canClone: true })).toBe(true);
    expect(canCreateClone({ alive: true, isClone: true, canClone: false })).toBe(false);
    expect(canCreateClone({ alive: false, isClone: false, canClone: true })).toBe(false);
  });

  it('aumenta la vida en dos por cada clon y nunca devuelve vida inválida', () => {
    expect([1, 2, 3, 4, 5].map(cloneHealthForNumber)).toEqual([2, 4, 6, 8, 10]);
    expect(cloneHealthForNumber(0)).toBe(1);
    expect(cloneHealthForNumber(-3)).toBe(1);
  });
});
