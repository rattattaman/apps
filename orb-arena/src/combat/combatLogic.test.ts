import { describe, expect, it } from 'vitest';
import { advanceHammerSpin, burstShotDelays, ContactCooldowns, copyWeaponProgress, growSlimeDps, progressAfterHit, type WeaponProgress } from './combatLogic';

const base: WeaponProgress = {
  damage: 8, range: 60, angularSpeed: 2, burstSize: 1, explosionSize: 1, shieldSize: 1, maxSpeed: 3, cutCount: 1,
};

describe('progresión de armas', () => {
  it('incrementa solo la estadística distintiva de cada arma', () => {
    expect(progressAfterHit('sword', base)).toMatchObject({ damage: 9, angularSpeed: 2 });
    expect(progressAfterHit('dagger', base)).toMatchObject({ damage: 8, angularSpeed: 3.5 });
    expect(progressAfterHit('spear', base)).toMatchObject({ damage: 8.5, range: 63 });
    expect(progressAfterHit('bow', base)).toMatchObject({ burstSize: 2 });
    expect(progressAfterHit('wand', base)).toMatchObject({ damage: 9, explosionSize: 2 });
    expect(progressAfterHit('shield', base)).toMatchObject({ shieldSize: 2 });
    expect(progressAfterHit('scythe', base)).toEqual(base);
    expect(progressAfterHit('unarmed', base)).toMatchObject({ maxSpeed: 3.5 });
    expect(progressAfterHit('wrench', base)).toEqual(base);
    expect(progressAfterHit('katana', base)).toMatchObject({ cutCount: 2 });
    expect(progressAfterHit('joust', { ...base, damage: 1, chargeDamage: 1 })).toMatchObject({ damage: 1, chargeDamage: 3 });
    expect(progressAfterHit('hammer', { ...base, angularSpeed: 1, maxAngularSpeed: 3 })).toMatchObject({ angularSpeed: 1, maxAngularSpeed: 4 });
  });

  it('copia toda la progresión jugable sin compartir estado mutable', () => {
    const source = { ...base, damage: 12, range: 90, angularSpeed: 5, maxSpeed: 7, burstSize: 12, explosionSize: 8, cutCount: 6, shurikenBounces: 4.2, healthGain: 3.5 };
    const copied = copyWeaponProgress(source);
    expect(copied).toEqual(source);
    expect(copied).not.toBe(source);
  });
});

describe('recarga por atacante y objetivo', () => {
  it('bloquea daño repetido y permite otros objetivos', () => {
    const cooldowns = new ContactCooldowns();
    expect(cooldowns.canTrigger('sol', 'nexo', 1000, 400)).toBe(true);
    expect(cooldowns.canTrigger('sol', 'nexo', 1200, 400)).toBe(false);
    expect(cooldowns.canTrigger('sol', 'vanta', 1200, 400)).toBe(true);
    expect(cooldowns.canTrigger('sol', 'nexo', 1400, 400)).toBe(true);
  });
});

describe('ráfaga escalonada del arco', () => {
  it('programa cada flecha en un instante distinto', () => {
    expect(burstShotDelays(4, 80)).toEqual([0, 80, 160, 240]);
  });
});

describe('mecánicas de Frasco y Martillo', () => {
  it('acelera el martillo hasta su máximo sin sobrepasarlo', () => {
    expect(advanceHammerSpin(1, 3, 1, 0.5)).toBe(1.5);
    expect(advanceHammerSpin(2.8, 3, 1, 1)).toBe(3);
  });

  it('solo aumenta el DPS de la baba cuando hay un enemigo dentro', () => {
    expect(growSlimeDps(1, false)).toBe(1);
    expect(growSlimeDps(1, true)).toBe(1.2);
  });
});
