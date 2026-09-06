import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { ARENA } from '../config/balance';
import { Combatant } from './Combatant';

vi.mock('phaser', () => ({
  default: { Math: { Vector2: class { constructor(public x: number, public y: number) {} } } },
}));

vi.mock('../weapons/OrbitWeapon', () => ({
  OrbitWeapon: class {
    maxSpeed = 8.8;
    angle = 0;
    update = vi.fn();
    render = vi.fn();
    destroy = vi.fn();
  },
}));

function createCombatant(radius = ARENA.orbRadius as number) {
  const orb = {
    x: 100, y: 150, scaleX: 1, scaleY: 1,
    body: { label: '', velocity: { x: 4, y: 0 } },
    setTint: vi.fn().mockReturnThis(), setBounce: vi.fn().mockReturnThis(),
    setFriction: vi.fn().mockReturnThis(), setFixedRotation: vi.fn().mockReturnThis(),
    setCollisionCategory: vi.fn().mockReturnThis(), setCollidesWith: vi.fn().mockReturnThis(),
    setScale: vi.fn(function (this: { scaleX: number; scaleY: number }, x: number, y = x) {
      this.scaleX = x; this.scaleY = y; return this;
    }),
    setVelocity: vi.fn(), destroy: vi.fn(),
  };
  const ring = {
    x: 0, y: 0,
    clear: vi.fn().mockReturnThis(), lineStyle: vi.fn().mockReturnThis(),
    strokeCircle: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(),
    setPosition: vi.fn(function (this: { x: number; y: number }, x: number, y: number) {
      this.x = x; this.y = y; return this;
    }),
    destroy: vi.fn(),
  };
  const label = {
    setOrigin: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(), destroy: vi.fn(),
  };
  const callbacks: Array<() => void> = [];
  const scene = {
    matter: { add: { image: vi.fn(() => orb) } },
    add: { graphics: vi.fn(() => ring), text: vi.fn(() => label) },
    time: { delayedCall: vi.fn((_delay: number, callback: () => void) => callbacks.push(callback)) },
  };
  const fighter = new Combatant(scene as unknown as Phaser.Scene, {
    name: 'SOL', weapon: 'sword', color: 0xffbf43, colorCss: '#ffbf43', season: 1,
  }, 0, orb.x, orb.y, 100, 0, { radius });
  return { fighter, orb, ring, label, callbacks };
}

describe('visual y ciclo de vida del combatiente', () => {
  it('mantiene los anillos centrados al moverse y actualiza sus radios al crecer', () => {
    const { fighter, orb, ring } = createCombatant(18);
    fighter.update(1 / 60, 1, 1);
    expect(ring.strokeCircle.mock.calls).toEqual([[0, 0, 14], [0, 0, 22]]);
    expect([ring.x, ring.y]).toEqual([orb.x, orb.y]);

    orb.x = 270; orb.y = 320;
    fighter.update(1 / 60, 1, 1);
    expect([ring.x, ring.y]).toEqual([270, 320]);
    expect(ring.clear).toHaveBeenCalledTimes(1);

    fighter.growRadius(2);
    fighter.update(1 / 60, 1, 1);
    expect(ring.strokeCircle.mock.calls.slice(-2)).toEqual([[0, 0, 16], [0, 0, 24]]);
    expect(ring.clear).toHaveBeenCalledTimes(2);
    expect(orb.scaleX).toBeCloseTo(20 / ARENA.orbRadius);
  });

  it('conserva daño, invulnerabilidad y curación al actualizar la presentación', () => {
    const { fighter } = createCombatant();
    fighter.update(1 / 60, 1, 1);
    expect(fighter.damage(30)).toBe(30);
    fighter.setInvulnerable(true);
    expect(fighter.damage(90)).toBe(0);
    expect(fighter.health).toBe(70);
    fighter.setInvulnerable(false);
    expect(fighter.heal(80)).toBe(30);
    expect(fighter.heal(5, true)).toBe(5);
    expect(fighter.damage(200)).toBe(105);
    expect(fighter.health).toBe(0);
  });

  it('destruye una vez todos los objetos y no revive efectos después de morir', () => {
    const { fighter, orb, ring, label, callbacks } = createCombatant();
    fighter.damage(1);
    fighter.eliminate();
    fighter.eliminate();
    const tintCalls = orb.setTint.mock.calls.length;
    for (const callback of callbacks) callback();
    fighter.update(1 / 60, 1, 1);
    expect(fighter.alive).toBe(false);
    expect(fighter.damage(10)).toBe(0);
    expect(fighter.heal(10)).toBe(0);
    expect(orb.setTint).toHaveBeenCalledTimes(tintCalls);
    expect(orb.destroy).toHaveBeenCalledTimes(1);
    expect(ring.destroy).toHaveBeenCalledTimes(1);
    expect(label.destroy).toHaveBeenCalledTimes(1);
    expect(fighter.weapon.destroy).toHaveBeenCalledTimes(1);
    expect(fighter.weapon.update).not.toHaveBeenCalled();
  });
});
