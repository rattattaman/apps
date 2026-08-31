import { describe, expect, it } from 'vitest';
import { pointToSegmentDistanceSquared, segmentDistanceSquared, segmentsIntersect } from './geometry';

describe('geometría de impactos', () => {
  it('calcula la distancia a un arma segmentada', () => {
    expect(pointToSegmentDistanceSquared({ x: 5, y: 3 }, {
      start: { x: 0, y: 0 }, end: { x: 10, y: 0 },
    })).toBe(9);
  });

  it('detecta una parada cuando dos armas se cruzan', () => {
    const first = { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } };
    const second = { start: { x: 0, y: 10 }, end: { x: 10, y: 0 } };
    expect(segmentsIntersect(first, second)).toBe(true);
    expect(segmentDistanceSquared(first, second)).toBe(0);
  });

  it('mantiene separados segmentos distantes', () => {
    expect(segmentDistanceSquared(
      { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
      { start: { x: 0, y: 5 }, end: { x: 10, y: 5 } },
    )).toBe(25);
  });
});
