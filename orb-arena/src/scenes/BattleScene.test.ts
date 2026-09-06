import { expect, it, vi } from 'vitest';
import { BattleScene } from './BattleScene';

vi.mock('phaser', () => ({ default: { Scene: class {}, Events: { EventEmitter: class { emit = vi.fn(); } } } }));

it('Escudo daña por choque una vez por cooldown sin crecer y permite un contacto posterior', () => {
  const scene = new BattleScene() as unknown as {
    time: { now: number };
    applyShieldImpact(a: object, b: object): void;
    applyDamage: ReturnType<typeof vi.fn>;
  };
  const shield = { id: 's', alive: true, selection: { weapon: 'shield' }, weapon: { damage: 1 } };
  const target = { id: 'g', alive: true, x: 30, y: 40 };
  scene.time = { now: 0 };
  scene.applyDamage = vi.fn();
  scene.applyShieldImpact(shield, target);
  scene.applyShieldImpact(shield, target);
  expect(scene.applyDamage).toHaveBeenCalledExactlyOnceWith(shield, target, 1, 1.05, 30, 40, false);
  scene.time.now = 420;
  scene.applyShieldImpact(shield, target);
  expect(scene.applyDamage).toHaveBeenCalledTimes(2);
  target.alive = false;
  scene.time.now = 840;
  scene.applyShieldImpact(shield, target);
  expect(scene.applyDamage).toHaveBeenCalledTimes(2);
});

it('el daño central respeta equipos y registra solo el daño aplicado', () => {
  const scene = new BattleScene() as unknown as {
    dealDamage(a: object,b: object,amount:number):number;
    ledger: {hit: ReturnType<typeof vi.fn>};
  };
  scene.ledger.hit = vi.fn();
  const source = {id:'a',team:'A',alive:true};
  const ally = {id:'b',team:'A',alive:true,damage:vi.fn(()=>3)};
  const enemy = {id:'c',team:'B',alive:true,damage:vi.fn(()=>3)};
  expect(scene.dealDamage(source,ally,100)).toBe(0);
  expect(ally.damage).not.toHaveBeenCalled();
  expect(scene.dealDamage(source,enemy,100)).toBe(3);
  expect(scene.ledger.hit).toHaveBeenCalledExactlyOnceWith('a','c',3);
});

it('difiere el daño hasta salir del solver y conserva la velocidad original del impacto', () => {
  type Body = { label: string; velocity: { x: number; y: number } };
  type Pair = { bodyA: Body; bodyB: Body; velocityA?: Body['velocity']; velocityB?: Body['velocity'] };
  const scene = new BattleScene() as unknown as {
    fighters: object[];
    time: { now: number };
    collisionPairs: Pair[];
    onCollisionStart(event: { pairs: Pair[] }): void;
    processCollisions(event: { pairs: Pair[] }): void;
    applyDamage: ReturnType<typeof vi.fn>;
  };
  const attacker = { id: 'fighter-0', alive: true, selection: { weapon: 'unarmed' } };
  const target = { id: 'fighter-1', alive: true, selection: { weapon: 'sword' }, x: 100, y: 100 };
  scene.fighters = [attacker, target];
  scene.time = { now: 1000 };
  scene.applyDamage = vi.fn();
  const first = { label: 'fighter-0', velocity: { x: 3, y: 4 } };
  const second = { label: 'fighter-1', velocity: { x: -2, y: 0 } };
  scene.onCollisionStart({ pairs: [{ bodyA: first, bodyB: second }] });
  expect(scene.applyDamage).not.toHaveBeenCalled();
  first.velocity.x = 9;
  first.velocity.y = 0;
  scene.processCollisions({ pairs: scene.collisionPairs.splice(0) });
  expect(scene.applyDamage).toHaveBeenCalledExactlyOnceWith(attacker, target, 5, 1.35, 100, 100);
  scene.onCollisionStart({ pairs: [{ bodyA: first, bodyB: second }] });
  scene.processCollisions({ pairs: scene.collisionPairs.splice(0) });
  expect(scene.applyDamage).toHaveBeenCalledTimes(1);
});
