import { describe, expect, it } from 'vitest';
import { closestArenaWall, escapeWallVelocity } from './physicsLogic';

describe('salida de paredes', () => {
  it('identifica la pared más cercana', () => {
    expect(closestArenaWall(35, 300, 34, 1120, 650)).toBe('left');
    expect(closestArenaWall(700, 615, 34, 1120, 650)).toBe('bottom');
  });

  it('garantiza velocidad hacia el interior en los cuatro lados', () => {
    expect(escapeWallVelocity('left', { x: 0, y: 4 }, 2.5)).toEqual({ x: 2.5, y: 4 });
    expect(escapeWallVelocity('right', { x: 0.2, y: -3 }, 2.5)).toEqual({ x: -2.5, y: -3 });
    expect(escapeWallVelocity('top', { x: 3, y: -0.1 }, 2.5)).toEqual({ x: 3, y: 2.5 });
    expect(escapeWallVelocity('bottom', { x: -2, y: 0 }, 2.5)).toEqual({ x: -2, y: -2.5 });
  });
});
