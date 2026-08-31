import { describe, expect, it } from 'vitest';
import { arenaSizeForFighterCount, fireballExplosionRadius, shieldWidthForSize, WEAPONS } from './balance';

describe('arenaSizeForFighterCount', () => {
  it('concentra la arena cuando participan menos orbes', () => {
    expect(arenaSizeForFighterCount(2)).toBe(600);
    expect(arenaSizeForFighterCount(3)).toBe(710);
    expect(arenaSizeForFighterCount(4)).toBe(820);
    expect(arenaSizeForFighterCount(5)).toBe(920);
    expect(arenaSizeForFighterCount(6)).toBe(1020);
  });

  it('inicia varita y escudo en nivel uno', () => {
    expect(WEAPONS.wand.damage).toBe(1);
    expect(WEAPONS.wand.initialExplosionSize).toBe(1);
    expect(WEAPONS.shield.initialShieldSize).toBe(1);
  });

  it('hace crecer físicamente la explosión y el ancho del escudo', () => {
    expect(fireballExplosionRadius(2)).toBeGreaterThan(fireballExplosionRadius(1));
    expect(shieldWidthForSize(2)).toBeGreaterThan(shieldWidthForSize(1));
  });
});

describe('balance inicial de armas', () => {
  it('inicia daga y arco con un punto de daño y el arco con tres flechas', () => {
    expect(WEAPONS.dagger.damage).toBe(1);
    expect(WEAPONS.bow.damage).toBe(1);
    expect(WEAPONS.bow.initialBurstSize).toBe(3);
  });
});
