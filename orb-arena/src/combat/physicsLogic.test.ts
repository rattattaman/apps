import { describe, expect, it } from 'vitest';
import { ARENA } from '../config/balance';
import { resolveArenaWallContact } from './physicsLogic';

const resolve = (x: number, y: number, velocity: { x: number; y: number }) =>
  resolveArenaWallContact(
    x, y, velocity, ARENA.padding, ARENA.width, ARENA.height, ARENA.orbRadius, ARENA.minSpeed,
  );

const nearRight = ARENA.width - ARENA.padding - ARENA.orbRadius;
const nearBottom = ARENA.height - ARENA.padding - ARENA.orbRadius;
const correctedFarEdge = nearRight - 1.5;

describe('salida de paredes', () => {
  it('separa la bola de una pared y fuerza velocidad hacia el interior', () => {
    expect(resolve(63, 300, { x: 0, y: 4 })).toEqual({
      x: 64.5,
      y: 300,
      velocity: { x: 2.9, y: 4 },
      corrected: true,
    });
    expect(resolve(nearRight, 300, { x: 0.2, y: -3 }).velocity).toEqual({ x: -2.9, y: -3 });
  });

  it('corrige ambos ejes al quedar atrapada en una esquina', () => {
    expect(resolve(63, nearBottom, { x: -0.1, y: 0 })).toEqual({
      x: 64.5,
      y: correctedFarEdge,
      velocity: { x: 2.9, y: -2.9 },
      corrected: true,
    });
  });

  it('no altera una bola que circula dentro de la arena', () => {
    expect(resolve(300, 250, { x: 3, y: -2 })).toEqual({
      x: 300,
      y: 250,
      velocity: { x: 3, y: -2 },
      corrected: false,
    });
  });
});
