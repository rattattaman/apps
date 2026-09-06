import { expect, it } from 'vitest';
import { Tournament } from './Tournament';
import { DEFAULT_FIGHTERS } from '../config/balance';

it.each([2,3,4,5,7,10,17,22])('la copa de %i participantes termina con empates y pases', count => {
  const cup = new Tournament(DEFAULT_FIGHTERS.slice(0,count), 'test');
  let match = cup.next(), safety = 0;
  while (match && safety++ < 300) {
    expect(match.a).not.toBe(match.b);
    cup.record(match.id, null, 10, 10);
    cup.record(match.id, 'a', 1000, 1000); // duplicate callback must do nothing
    match = cup.next();
  }
  expect(safety).toBeLessThan(300);
  expect(cup.champion).toBeTruthy();
  expect(cup.entrants).toHaveLength(count);
  expect(cup.entrants.every(e => e.damage < 1000)).toBe(true);
});
it('reinicia torneo y reproduce sorteos sin inventar participantes', () => {
  const a = new Tournament(DEFAULT_FIGHTERS.slice(0,5), 'seed');
  const b = new Tournament(DEFAULT_FIGHTERS.slice(0,5), 'seed');
  expect(a.entrants).toEqual(b.entrants);
  const m = a.next()!; a.record(m.id, 'a', 30, 5);
  expect(b.entry(m.a).played).toBe(0);
});
