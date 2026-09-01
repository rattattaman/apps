import { describe, expect, it } from 'vitest';
import { burstShotDelays, ContactCooldowns, copyNormalCombatProgress, progressAfterHit, type WeaponProgress } from './combatLogic';

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
  });

  it('copia estadísticas normales sin arrastrar habilidades especiales ni compartir estado', () => {
    const cloneBase = { ...base, damage: 1, range: 20, angularSpeed: 1, maxSpeed: 4, burstSize: 1, explosionSize: 0, cutCount: 0 };
    const copied = copyNormalCombatProgress(cloneBase, { ...base, damage: 12, range: 90, angularSpeed: 5, maxSpeed: 7, burstSize: 9, explosionSize: 8, cutCount: 6 });
    expect(copied).toMatchObject({ damage: 12, range: 90, angularSpeed: 5, maxSpeed: 7 });
    expect(copied).toMatchObject({ burstSize: 1, explosionSize: 0, cutCount: 0 });
    expect(copied).not.toBe(cloneBase);
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
