import Phaser from 'phaser';
import { COLLISION, type Combatant } from '../combat/Combatant';
import { BOOMERANG } from '../config/balance';

export class Boomerang {
  readonly id: string;
  readonly sprite: Phaser.Physics.Matter.Image;
  readonly bornAt: number;
  alive = true;
  private readonly hitTargets = new Set<string>();

  constructor(
    scene: Phaser.Scene,
    readonly owner: Combatant,
    private readonly launchAngle: number,
    private readonly direction: number,
    sequence: number,
  ) {
    this.id = `boomerang-${sequence}`;
    this.bornAt = scene.time.now;
    const start = this.positionAt(0);
    this.sprite = scene.matter.add.image(start.x, start.y, 'boomerang', undefined, {
      shape: { type: 'circle', radius: BOOMERANG.radius },
      isSensor: true,
      frictionAir: 0,
    });
    this.sprite.setCollisionCategory(COLLISION.projectile).setCollidesWith(0).setRotation(this.launchAngle);
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }
  get hitRadius(): number { return BOOMERANG.radius; }

  update(now: number): void {
    if (!this.alive) return;
    if (!this.owner.alive) {
      this.destroy();
      return;
    }
    const progress = Math.max(0, (now - this.bornAt) / BOOMERANG.flightDurationMs);
    if (progress >= 1) {
      this.destroy();
      return;
    }
    const position = this.positionAt(progress);
    this.sprite.setPosition(position.x, position.y);
    this.sprite.setRotation(this.sprite.rotation + 0.34 * this.direction);
  }

  canHit(targetId: string): boolean { return !this.hitTargets.has(targetId); }
  registerHit(targetId: string): void { this.hitTargets.add(targetId); }

  destroy(): void {
    if (!this.alive) return;
    this.alive = false;
    this.sprite.destroy();
  }

  private positionAt(progress: number): { x: number; y: number } {
    if (progress <= BOOMERANG.orbitShare) {
      const arcProgress = progress / BOOMERANG.orbitShare;
      const angle = this.launchAngle + Math.PI * arcProgress * this.direction;
      return {
        x: this.owner.x + Math.cos(angle) * BOOMERANG.orbitDistance,
        y: this.owner.y + Math.sin(angle) * BOOMERANG.orbitDistance,
      };
    }
    const returnProgress = (progress - BOOMERANG.orbitShare) / (1 - BOOMERANG.orbitShare);
    const angle = this.launchAngle + Math.PI * this.direction;
    const distance = BOOMERANG.orbitDistance * (1 - returnProgress);
    return {
      x: this.owner.x + Math.cos(angle) * distance,
      y: this.owner.y + Math.sin(angle) * distance,
    };
  }
}
