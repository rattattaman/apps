import Phaser from 'phaser';
import { COLLISION, type Combatant } from '../combat/Combatant';
import { FIREBALL, PROJECTILES } from '../config/balance';

export type ProjectileKind = 'arrow' | 'fireball' | 'bolt';

export class Projectile {
  readonly id: string;
  readonly sprite: Phaser.Physics.Matter.Image;
  readonly bornAt: number;
  alive = true;
  lastDeflectedAt = -Infinity;

  constructor(
    scene: Phaser.Scene,
    readonly owner: Combatant,
    readonly damage: number,
    x: number,
    y: number,
    angle: number,
    sequence: number,
    readonly kind: ProjectileKind = 'arrow',
    readonly explosionSize = 0,
  ) {
    this.id = `${kind}-${sequence}`;
    this.bornAt = scene.time.now;
    this.sprite = scene.matter.add.image(x, y, kind, undefined, {
      shape: kind === 'fireball'
        ? { type: 'circle', radius: FIREBALL.radius }
        : { type: 'rectangle', width: 30, height: 7 },
      isSensor: true,
      frictionAir: 0,
    });
    this.sprite.setCollisionCategory(COLLISION.projectile).setCollidesWith(0).setRotation(angle);
    const speed = kind === 'fireball' ? FIREBALL.speed : PROJECTILES.speed;
    this.sprite.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }
  get hitRadius(): number { return this.kind === 'fireball' ? FIREBALL.radius : PROJECTILES.radius; }

  update(now: number): void {
    if (!this.alive) return;
    const body = this.sprite.body as MatterJS.BodyType;
    if (this.kind !== 'fireball') this.sprite.setRotation(Math.atan2(body.velocity.y, body.velocity.x));
    if (now - this.bornAt > PROJECTILES.lifetimeMs) this.destroy();
  }

  deflect(normalAngle: number, now: number): void {
    const body = this.sprite.body as MatterJS.BodyType;
    const baseSpeed = this.kind === 'fireball' ? FIREBALL.speed : PROJECTILES.speed;
    const speed = Math.min(baseSpeed * 1.2, Math.hypot(body.velocity.x, body.velocity.y) * 1.08);
    const velocityAngle = Math.atan2(body.velocity.y, body.velocity.x);
    const reflected = 2 * normalAngle - velocityAngle + Math.PI;
    this.sprite.setVelocity(Math.cos(reflected) * speed, Math.sin(reflected) * speed);
    this.lastDeflectedAt = now;
  }

  destroy(): void {
    if (!this.alive) return;
    this.alive = false;
    this.sprite.destroy();
  }
}
