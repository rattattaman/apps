import { describe, expect, it } from 'vitest';
import { arenaSizeForFighterCount, WEAPONS } from './balance';

describe('arenaSizeForFighterCount', () => {
  it('concentra la arena cuando participan menos orbes', () => {
    expect(arenaSizeForFighterCount(2)).toBe(600);
    expect(arenaSizeForFighterCount(3)).toBe(710);
    expect(arenaSizeForFighterCount(4)).toBe(820);
  });
});

describe('balance inicial de armas', () => {
  it('inicia daga y arco con un punto de daño y el arco con tres flechas', () => {
    expect(WEAPONS.dagger.damage).toBe(1);
    expect(WEAPONS.bow.damage).toBe(1);
    expect(WEAPONS.bow.initialBurstSize).toBe(3);
  });
});
