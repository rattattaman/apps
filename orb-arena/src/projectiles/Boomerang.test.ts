import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import type { Combatant } from '../combat/Combatant';
import { BOOMERANG } from '../config/balance';
import { Boomerang } from './Boomerang';

vi.mock('phaser', () => ({ default: {} }));

function createBoomerang() {
  const sprite = {
    x: 0, y: 0, rotation: 0,
    setCollisionCategory: vi.fn().mockReturnThis(), setCollidesWith: vi.fn().mockReturnThis(),
    setRotation: vi.fn(function (this: { rotation: number }, value: number) { this.rotation = value; return this; }),
    setPosition: vi.fn(function (this: { x: number; y: number }, x: number, y: number) { this.x = x; this.y = y; return this; }),
    destroy: vi.fn(),
  };
  const scene = { time: { now: 1000 }, matter: { add: { image: vi.fn((_x: number, _y: number) => {
    sprite.x = _x; sprite.y = _y; return sprite;
  }) } } };
  const owner = { alive: true, x: 200, y: 300 } as Combatant;
  const boomerang = new Boomerang(scene as unknown as Phaser.Scene, owner, 0, 1, 4);
  return { boomerang, owner, sprite };
}

describe('trayectoria del boomerang', () => {
  it('recorre medio círculo alrededor del dueño y después vuelve', () => {
    const { boomerang, owner, sprite } = createBoomerang();
    expect(sprite.x).toBeCloseTo(owner.x + BOOMERANG.orbitDistance);
    expect(sprite.y).toBeCloseTo(owner.y);

    boomerang.update(boomerang.bornAt + BOOMERANG.flightDurationMs * BOOMERANG.orbitShare);
    expect(sprite.x).toBeCloseTo(owner.x - BOOMERANG.orbitDistance);
    expect(sprite.y).toBeCloseTo(owner.y);

    const returnProgress = BOOMERANG.orbitShare + (1 - BOOMERANG.orbitShare) / 2;
    boomerang.update(boomerang.bornAt + BOOMERANG.flightDurationMs * returnProgress);
    expect(sprite.x).toBeCloseTo(owner.x - BOOMERANG.orbitDistance / 2);
    expect(sprite.y).toBeCloseTo(owner.y);

    boomerang.update(boomerang.bornAt + BOOMERANG.flightDurationMs);
    expect(boomerang.alive).toBe(false);
    expect(sprite.destroy).toHaveBeenCalledTimes(1);
  });

  it('solo permite registrar una vez a cada objetivo durante el lanzamiento', () => {
    const { boomerang } = createBoomerang();
    expect(boomerang.canHit('rival')).toBe(true);
    boomerang.registerHit('rival');
    expect(boomerang.canHit('rival')).toBe(false);
    expect(boomerang.canHit('otro')).toBe(true);
  });
});
