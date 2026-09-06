import { expect, it } from 'vitest';
import { BattleLedger } from './BattleLedger';
import { rivals, survivingTeams } from './allegiance';

it('atribuye invocaciones encadenadas, distingue bajas y reinicia estadísticas', () => {
  const ledger = new BattleLedger();
  ledger.principal('a', { name: 'A', weapon: 'grimoire', color: 1, colorCss: '#fff', season: 1 }, 100);
  ledger.principal('b', { name: 'B', weapon: 'shield', color: 1, colorCss: '#fff', season: 1 }, 100);
  ledger.summon('clone', 'a'); ledger.summon('copy', 'clone');
  ledger.hit('copy', 'b', 3); ledger.hit('a', 'clone', 2);
  ledger.eliminate('copy', 'b'); ledger.eliminate('copy', 'b'); ledger.eliminate('a', 'clone');
  expect(ledger.snapshot(new Map([['a', 42]]))[0]).toMatchObject({ damage: 5, principalDamage: 3, eliminations: 1, summonsDestroyed: 1, health: 42 });
  ledger.reset(); expect(ledger.snapshot(new Map())).toEqual([]);
});
it('equipos lógicos y principales deciden victoria, no color ni invocaciones', () => {
  expect(rivals({id:'a',team:'A',alive:true}, {id:'b',team:'A',alive:true})).toBe(false);
  expect(rivals({id:'a',alive:true}, {id:'b',alive:true})).toBe(true);
  expect(survivingTeams([{id:'a',team:'A',alive:false},{id:'clone',team:'A',alive:true,isClone:true},{id:'b',team:'B',alive:true}])).toEqual(['B']);
  expect(survivingTeams([])).toEqual([]);
});
