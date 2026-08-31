import Phaser from 'phaser';
import { COLLISION, type Combatant } from '../combat/Combatant';
import { PROJECTILES } from '../config/balance';

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
  ) {
    this.id = `arrow-${sequence}`;
    this.bornAt = scene.time.now;
    this.sprite = scene.matter.add.image(x, y, 'arrow', undefined, {
      shape: { type: 'rectangle', width: 30, height: 7 },
      isSensor: true,
      frictionAir: 0,
    });
    this.sprite.setCollisionCategory(COLLISION.projectile).setCollidesWith(0).setRotation(angle);
    this.sprite.setVelocity(Math.cos(angle) * PROJECTILES.speed, Math.sin(angle) * PROJECTILES.speed);
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }

  update(now: number): void {
    if (!this.alive) return;
    const body = this.sprite.body as MatterJS.BodyType;
    this.sprite.setRotation(Math.atan2(body.velocity.y, body.velocity.x));
    if (now - this.bornAt > PROJECTILES.lifetimeMs) this.destroy();
  }

  deflect(normalAngle: number, now: number): void {
    const body = this.sprite.body as MatterJS.BodyType;
    const speed = Math.min(PROJECTILES.speed * 1.2, Math.hypot(body.velocity.x, body.velocity.y) * 1.08);
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
