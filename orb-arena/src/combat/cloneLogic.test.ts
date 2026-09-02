import { describe, expect, it } from 'vitest';
import { canCreateClone, cloneHealthForNumber, createCloneIdentity } from './cloneLogic';

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

  it('separa el arma jugable del aspecto de Grimorio', () => {
    const bow = { name: 'VANTA', weapon: 'bow' as const, color: 0x9d70f8, colorCss: '#9d70f8', season: 1 };
    const grimoire = { name: 'TOME', weapon: 'grimoire' as const, color: 0x22cc88, colorCss: '#22cc88', season: 2 };
    const identity = createCloneIdentity(bow, grimoire, 3);
    expect(identity.gameplaySelection.weapon).toBe('bow');
    expect(identity.visualSelection).toMatchObject({ name: 'TOME·3', weapon: 'grimoire', color: 0x22cc88 });
    expect(identity.gameplaySelection).not.toBe(bow);
    expect(identity.visualSelection).not.toBe(grimoire);
  });
});
