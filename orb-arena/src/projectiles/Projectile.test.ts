import type Phaser from 'phaser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Combatant } from '../combat/Combatant';
import { BOTTLE, FIREBALL, PROJECTILES } from '../config/balance';
import { Projectile, type ProjectileKind } from './Projectile';

const { distanceBetween } = vi.hoisted(() => ({
  distanceBetween: vi.fn((x1: number, y1: number, x2: number, y2: number) => Math.hypot(x2 - x1, y2 - y1)),
}));
vi.mock('phaser', () => ({ default: { Math: { Distance: { Between: distanceBetween } } } }));

function createProjectile(kind: ProjectileKind) {
  const sprite = {
    x: 100, y: 200, rotation: 0,
    body: { velocity: { x: 0, y: 0 } },
    setCollisionCategory: vi.fn().mockReturnThis(), setCollidesWith: vi.fn().mockReturnThis(),
    setRotation: vi.fn(function (this: { rotation: number }, value: number) {
      this.rotation = value; return this;
    }),
    setVelocity: vi.fn(function (this: { body: { velocity: { x: number; y: number } } }, x: number, y: number) {
      this.body.velocity = { x, y }; return this;
    }),
    destroy: vi.fn(),
  };
  const scene = { time: { now: 1000 }, matter: { add: { image: vi.fn(() => sprite) } } };
  const owner = { alive: true } as Combatant;
  const projectile = new Projectile(scene as unknown as Phaser.Scene, owner, 3, sprite.x, sprite.y, 0, 1, kind, 2, 1);
  return { projectile, sprite, scene, owner };
}

beforeEach(() => distanceBetween.mockClear());

describe('recorrido y ciclo de vida de proyectiles', () => {
  it('rompe el frasco por distancia acumulada incluyendo cambios de dirección', () => {
    const { projectile, sprite } = createProjectile('bottle');
    sprite.x += 100;
    projectile.update(1016);
    sprite.x -= 100;
    projectile.update(1032);
    expect(projectile.shouldBreakBottle()).toBe(false);
    sprite.y += BOTTLE.breakDistance - 200;
    projectile.update(1048);
    expect(projectile.shouldBreakBottle()).toBe(true);
    expect(distanceBetween).toHaveBeenCalledTimes(3);
  });

  it.each(['arrow', 'bolt', 'shuriken', 'fireball'] as const)('evita medir recorridos de %s y conserva su velocidad', (kind) => {
    const { projectile, sprite } = createProjectile(kind);
    const speed = kind === 'fireball' ? FIREBALL.speed : PROJECTILES.speed;
    expect(sprite.body.velocity).toEqual({ x: speed, y: 0 });
    sprite.x += 300;
    projectile.update(1016);
    expect(distanceBetween).not.toHaveBeenCalled();
    expect(projectile.shouldBreakBottle()).toBe(false);
    expect(projectile.damage).toBe(3);
  });

  it('conserva la reflexión, aceleración limitada y número de rebotes', () => {
    const { projectile, sprite } = createProjectile('shuriken');
    projectile.deflect(0, 1100);
    expect(sprite.body.velocity.x).toBeCloseTo(-PROJECTILES.speed * 1.08);
    expect(sprite.body.velocity.y).toBeCloseTo(0);
    for (let index = 0; index < 10; index += 1) projectile.deflect(0, 1200);
    expect(Math.hypot(sprite.body.velocity.x, sprite.body.velocity.y)).toBeCloseTo(PROJECTILES.speed * 1.2);
    expect(projectile.lastDeflectedAt).toBe(1200);
    expect(projectile.canBounce()).toBe(true);
    projectile.bounce();
    expect(projectile.canBounce()).toBe(false);
  });

  it('caduca en el mismo instante y destruye el objeto físico una sola vez', () => {
    const { projectile, sprite, owner } = createProjectile('bolt');
    owner.alive = false;
    projectile.update(projectile.bornAt + PROJECTILES.lifetimeMs);
    expect(projectile.alive).toBe(true);
    projectile.update(projectile.bornAt + PROJECTILES.lifetimeMs + 1);
    projectile.destroy();
    projectile.update(projectile.bornAt + PROJECTILES.lifetimeMs + 2);
    expect(projectile.alive).toBe(false);
    expect(sprite.destroy).toHaveBeenCalledTimes(1);
  });
});
