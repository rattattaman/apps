import { describe, expect, it } from 'vitest';
import { resolveArenaWallContact } from './physicsLogic';

const resolve = (x: number, y: number, velocity: { x: number; y: number }) =>
  resolveArenaWallContact(x, y, velocity, 34, 1120, 650, 29, 2.9);

describe('salida de paredes', () => {
  it('separa la bola de una pared y fuerza velocidad hacia el interior', () => {
    expect(resolve(63, 300, { x: 0, y: 4 })).toEqual({
      x: 64.5,
      y: 300,
      velocity: { x: 2.9, y: 4 },
      corrected: true,
    });
    expect(resolve(1057, 300, { x: 0.2, y: -3 }).velocity).toEqual({ x: -2.9, y: -3 });
  });

  it('corrige ambos ejes al quedar atrapada en una esquina', () => {
    expect(resolve(63, 587, { x: -0.1, y: 0 })).toEqual({
      x: 64.5,
      y: 585.5,
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
