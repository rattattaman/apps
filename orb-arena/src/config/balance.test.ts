import { describe, expect, it } from 'vitest';
import { WEAPONS } from './balance';

describe('balance solicitado de armas', () => {
  it('inicia espada y lanza con un punto de daño', () => {
    expect(WEAPONS.sword.damage).toBe(1);
    expect(WEAPONS.spear.damage).toBe(1);
  });

  it('mantiene la daga como arma más corta y más rápida', () => {
    const otherWeapons = [WEAPONS.sword, WEAPONS.spear, WEAPONS.bow];
    expect(otherWeapons.every((weapon) => WEAPONS.dagger.range < weapon.range)).toBe(true);
    expect(otherWeapons.every((weapon) => WEAPONS.dagger.angularSpeed > weapon.angularSpeed)).toBe(true);
  });

  it('acelera todas las órbitas respecto al balance anterior', () => {
    expect(WEAPONS.sword.angularSpeed).toBeGreaterThan(2.25);
    expect(WEAPONS.dagger.angularSpeed).toBeGreaterThan(3.55);
    expect(WEAPONS.spear.angularSpeed).toBeGreaterThan(1.5);
    expect(WEAPONS.bow.angularSpeed).toBeGreaterThan(1.8);
  });
});
