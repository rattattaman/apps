import type Phaser from 'phaser';
import { expect, it, vi } from 'vitest';
import type { Combatant } from '../combat/Combatant';
import { OrbitWeapon } from './OrbitWeapon';

vi.mock('phaser', () => ({ default: { Math: { Distance: { Between: (x: number, y: number, u: number, v: number) => Math.hypot(x - u, y - v) } } } }));

it('reutiliza la geometría del Grimorio al girar/moverse, y la actualiza al crecer', () => {
  const graphics = new Proxy({} as Record<string, ReturnType<typeof vi.fn>>, {
    get(target, property: string) { return target[property] ??= vi.fn(() => graphics); },
  });
  const scene = { add: { graphics: () => graphics } } as unknown as Phaser.Scene;
  const owner = { selection: { weapon: 'grimoire' }, visualWeaponType: 'grimoire', visualColor: 0x123456, x: 100, y: 200, radius: 29 } as unknown as Combatant;
  const weapon = new OrbitWeapon(scene, owner, 0);
  weapon.render();
  expect(graphics.clear).toHaveBeenCalledTimes(1);
  const segment = weapon.segment();
  expect(weapon.segment()).toBe(segment);
  const oldAngle = weapon.angle;
  weapon.update(1 / 60, 1, false);
  expect(weapon.segment()).not.toBe(segment);
  expect(weapon.angle).toBeGreaterThan(oldAngle);
  expect(graphics.clear).toHaveBeenCalledTimes(1);
  weapon.render();
  expect(graphics.clear).toHaveBeenCalledTimes(1);
  weapon.grow(1.2);
  weapon.render();
  expect(graphics.clear).toHaveBeenCalledTimes(2);
  expect(graphics.strokeRoundedRect).toHaveBeenCalledTimes(2);
});
