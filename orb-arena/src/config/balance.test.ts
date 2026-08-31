import { describe, expect, it } from 'vitest';
import { arenaSizeForFighterCount } from './balance';

describe('arenaSizeForFighterCount', () => {
  it('concentra la arena cuando participan menos orbes', () => {
    expect(arenaSizeForFighterCount(2)).toBe(600);
    expect(arenaSizeForFighterCount(3)).toBe(710);
    expect(arenaSizeForFighterCount(4)).toBe(820);
  });
});
