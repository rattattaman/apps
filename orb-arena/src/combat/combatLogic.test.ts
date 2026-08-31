import { describe, expect, it } from 'vitest';
import { burstShotDelays, ContactCooldowns, progressAfterHit, type WeaponProgress } from './combatLogic';

const base: WeaponProgress = { damage: 8, range: 60, angularSpeed: 2, burstSize: 1 };

describe('progresión de armas', () => {
  it('incrementa solo la estadística distintiva de cada arma', () => {
    expect(progressAfterHit('sword', base)).toMatchObject({ damage: 9, angularSpeed: 2 });
    expect(progressAfterHit('dagger', base)).toMatchObject({ damage: 8, angularSpeed: 2.85 });
    expect(progressAfterHit('spear', base)).toMatchObject({ damage: 8.5, range: 63 });
    expect(progressAfterHit('bow', base)).toMatchObject({ burstSize: 2 });
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
    expect(burstShotDelays(4, 135)).toEqual([0, 135, 270, 405]);
  });
});
