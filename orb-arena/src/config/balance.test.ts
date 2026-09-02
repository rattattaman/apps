import { describe, expect, it } from 'vitest';
import { arenaSizeForFighterCount, fireballExplosionRadius, SEASON_ONE_FIGHTERS, SEASON_TWO_FIGHTERS, shieldWidthForSize, UNARMED, WEAPONS } from './balance';

describe('arenaSizeForFighterCount', () => {
  it('concentra la arena cuando participan menos orbes', () => {
    expect(arenaSizeForFighterCount(2)).toBe(600);
    expect(arenaSizeForFighterCount(3)).toBe(710);
    expect(arenaSizeForFighterCount(4)).toBe(820);
    expect(arenaSizeForFighterCount(5)).toBe(920);
    expect(arenaSizeForFighterCount(6)).toBe(1020);
    expect(arenaSizeForFighterCount(7)).toBe(1120);
    expect(arenaSizeForFighterCount(8)).toBe(1220);
    expect(arenaSizeForFighterCount(9)).toBe(1320);
    expect(arenaSizeForFighterCount(10)).toBe(1420);
  });

  it('inicia varita y escudo en nivel uno', () => {
    expect(WEAPONS.wand.damage).toBe(1);
    expect(WEAPONS.wand.initialExplosionSize).toBe(1);
    expect(WEAPONS.shield.initialShieldSize).toBe(1);
  });

  it('hace crecer físicamente la explosión y el ancho del escudo', () => {
    expect(fireballExplosionRadius(1)).toBe(70);
    expect(fireballExplosionRadius(2)).toBeGreaterThan(fireballExplosionRadius(1));
    expect(shieldWidthForSize(2)).toBeGreaterThan(shieldWidthForSize(1));
  });

  it('inicia el desarmado con velocidad máxima mejorada y la guadaña con daño uno', () => {
    expect(WEAPONS.unarmed.initialMaxSpeed).toBe(4.2);
    expect(WEAPONS.scythe.damage).toBe(1);
  });

  it('agrupa los ocho combatientes actuales en la temporada uno', () => {
    expect(SEASON_ONE_FIGHTERS).toHaveLength(8);
    expect(SEASON_ONE_FIGHTERS.every((fighter) => fighter.season === 1)).toBe(true);
    expect(UNARMED.gravityForce).toBe(0.00045);
  });

  it('inicia la temporada dos con llave inglesa y katana', () => {
    expect(SEASON_TWO_FIGHTERS).toHaveLength(8);
    expect(SEASON_TWO_FIGHTERS.every((fighter) => fighter.season === 2)).toBe(true);
    expect(WEAPONS.katana.initialCutCount).toBe(1);
    expect(WEAPONS.hammer.angularSpeed).toBe(1);
    expect(WEAPONS.hammer.initialMaxAngularSpeed).toBe(3);
  });
});

describe('balance inicial de armas', () => {
  it('inicia daga y arco con un punto de daño y el arco con tres flechas', () => {
    expect(WEAPONS.dagger.damage).toBe(1);
    expect(WEAPONS.bow.damage).toBe(1);
    expect(WEAPONS.bow.initialBurstSize).toBe(3);
  });
});
