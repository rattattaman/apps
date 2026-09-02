import Phaser from 'phaser';
import { COLLISION, type Combatant } from '../combat/Combatant';
import { BOTTLE, FIREBALL, PROJECTILES } from '../config/balance';

export type ProjectileKind = 'arrow' | 'fireball' | 'bolt' | 'shuriken' | 'bottle';

export class Projectile {
  readonly id: string;
  readonly sprite: Phaser.Physics.Matter.Image;
  readonly bornAt: number;
  bounces: number;
  alive = true;
  lastDeflectedAt = -Infinity;
  private travelledDistance = 0;
  private lastX: number;
  private lastY: number;

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
    readonly maxBounces = 0,
  ) {
    this.id = `${kind}-${sequence}`;
    this.bornAt = scene.time.now;
    this.sprite = scene.matter.add.image(x, y, kind, undefined, {
      shape: kind === 'fireball'
        ? { type: 'circle', radius: FIREBALL.radius }
        : kind === 'bottle'
          ? { type: 'circle', radius: 8 }
          : { type: 'rectangle', width: kind === 'shuriken' ? 18 : 30, height: kind === 'shuriken' ? 18 : 7 },
      isSensor: true,
      frictionAir: 0,
    });
    this.sprite.setCollisionCategory(COLLISION.projectile).setCollidesWith(0).setRotation(angle);
    this.bounces = 0;
    this.lastX = x;
    this.lastY = y;
    const speed = kind === 'fireball' ? FIREBALL.speed : PROJECTILES.speed;
    this.sprite.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }
  get hitRadius(): number { return this.kind === 'fireball' ? FIREBALL.radius : this.kind === 'bottle' ? 8 : PROJECTILES.radius; }

  update(now: number): void {
    if (!this.alive) return;
    this.travelledDistance += Phaser.Math.Distance.Between(this.lastX, this.lastY, this.x, this.y);
    this.lastX = this.x;
    this.lastY = this.y;
    const body = this.sprite.body as MatterJS.BodyType;
    if (this.kind !== 'fireball') this.sprite.setRotation(Math.atan2(body.velocity.y, body.velocity.x));
    if (now - this.bornAt > PROJECTILES.lifetimeMs) this.destroy();
  }

  shouldBreakBottle(): boolean { return this.kind === 'bottle' && this.travelledDistance >= BOTTLE.breakDistance; }

  deflect(normalAngle: number, now: number): void {
    const body = this.sprite.body as MatterJS.BodyType;
    const baseSpeed = this.kind === 'fireball' ? FIREBALL.speed : PROJECTILES.speed;
    const speed = Math.min(baseSpeed * 1.2, Math.hypot(body.velocity.x, body.velocity.y) * 1.08);
    const velocityAngle = Math.atan2(body.velocity.y, body.velocity.x);
    const reflected = 2 * normalAngle - velocityAngle + Math.PI;
    this.sprite.setVelocity(Math.cos(reflected) * speed, Math.sin(reflected) * speed);
    this.lastDeflectedAt = now;
  }

  canBounce(): boolean { return this.bounces < this.maxBounces; }
  bounce(): void { this.bounces += 1; }

  destroy(): void {
    if (!this.alive) return;
    this.alive = false;
    this.sprite.destroy();
  }
}
