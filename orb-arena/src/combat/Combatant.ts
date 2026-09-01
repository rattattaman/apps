import Phaser from 'phaser';
import { ARENA, UNARMED, WEAPONS } from '../config/balance';
import type { FighterSelection } from '../types';
import type { FighterHudState } from '../events';
import { OrbitWeapon } from '../weapons/OrbitWeapon';

export const COLLISION = {
  fighter: 0x0001,
  wall: 0x0002,
  projectile: 0x0004,
  turret: 0x0008,
} as const;

export class Combatant {
  readonly id: string;
  readonly orb: Phaser.Physics.Matter.Image;
  readonly weapon: OrbitWeapon;
  readonly selection: FighterSelection;
  readonly maxHealth: number;
  health: number;
  poisonStacks = 0;
  alive = true;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;

  constructor(
    private readonly scene: Phaser.Scene,
    selection: FighterSelection,
    index: number,
    x: number,
    y: number,
    maxHealth: number,
    initialAngle: number,
  ) {
    this.id = `fighter-${index}`;
    this.selection = selection;
    this.maxHealth = maxHealth;
    this.health = maxHealth;
    this.orb = scene.matter.add.image(x, y, 'orb', undefined, {
      shape: { type: 'circle', radius: ARENA.orbRadius },
      restitution: 1,
      friction: 0,
      frictionAir: 0,
    });
    this.orb.setTint(selection.color).setBounce(1).setFriction(0, 0, 0).setFixedRotation();
    this.orb.setCollisionCategory(COLLISION.fighter)
      .setCollidesWith([COLLISION.fighter, COLLISION.wall, COLLISION.turret]);
    const body = this.orb.body as MatterJS.BodyType;
    body.label = this.id;
    this.ring = scene.add.graphics().setDepth(3);
    this.label = scene.add.text(x, y, selection.name.slice(0, 2), {
      fontFamily: 'ui-monospace, monospace', fontSize: '12px', fontStyle: 'bold', color: '#10131b',
    }).setOrigin(0.5).setDepth(4);
    this.weapon = new OrbitWeapon(scene, this, initialAngle);
  }

  get x(): number { return this.orb.x; }
  get y(): number { return this.orb.y; }

  update(deltaSeconds: number, spinDirection: number, globalSpeed: number): void {
    if (!this.alive) return;
    this.weapon.update(deltaSeconds, spinDirection);
    if (this.selection.weapon === 'unarmed') {
      this.orb.applyForce(new Phaser.Math.Vector2(0, UNARMED.gravityForce));
    }
    this.keepMoving(globalSpeed);
    this.ring.clear()
      .lineStyle(2, 0xffffff, 0.25).strokeCircle(this.x, this.y, ARENA.orbRadius - 4)
      .lineStyle(2, this.selection.color, 0.55).strokeCircle(this.x, this.y, ARENA.orbRadius + 5);
    this.label.setPosition(this.x, this.y);
  }

  damage(amount: number): number {
    if (!this.alive) return 0;
    const applied = Math.min(this.health, amount);
    this.health = Math.max(0, this.health - amount);
    this.orb.setTint(0xffffff);
    this.scene.time.delayedCall(65, () => {
      if (this.alive) this.orb.setTint(this.selection.color);
    });
    return applied;
  }

  heal(amount: number, allowOverheal = false): number {
    if (!this.alive) return 0;
    const previous = this.health;
    this.health = allowOverheal ? this.health + amount : Math.min(this.maxHealth, this.health + amount);
    return this.health - previous;
  }

  addPoison(amount: number): number {
    if (!this.alive) return this.poisonStacks;
    this.poisonStacks += amount;
    return this.poisonStacks;
  }

  eliminate(): void {
    if (!this.alive) return;
    this.alive = false;
    this.weapon.destroy();
    this.ring.destroy();
    this.label.destroy();
    this.orb.destroy();
  }

  hudState(): FighterHudState {
    const definition = WEAPONS[this.selection.weapon];
    return {
      id: this.id,
      name: this.selection.name,
      weaponName: definition.name,
      ability: definition.ability,
      colorCss: this.selection.colorCss,
      health: this.health,
      maxHealth: this.maxHealth,
      alive: this.alive,
      stat: `${this.weapon.progressionText}${this.poisonStacks > 0 ? ` · VENENO ${this.poisonStacks}` : ''}`,
    };
  }

  private keepMoving(globalSpeed: number): void {
    const body = this.orb.body as MatterJS.BodyType;
    const speed = Math.hypot(body.velocity.x, body.velocity.y);
    if (this.selection.weapon === 'unarmed') {
      const maximum = this.weapon.maxSpeed * globalSpeed;
      if (speed > maximum) {
        const angle = Math.atan2(body.velocity.y, body.velocity.x);
        this.orb.setVelocity(Math.cos(angle) * maximum, Math.sin(angle) * maximum);
      }
      return;
    }
    const desiredMinimum = ARENA.minSpeed * globalSpeed;
    const maximum = ARENA.maxSpeed * globalSpeed;
    const angle = speed > 0.08 ? Math.atan2(body.velocity.y, body.velocity.x) : this.weapon.angle;
    if (speed < desiredMinimum) {
      this.orb.setVelocity(Math.cos(angle) * desiredMinimum, Math.sin(angle) * desiredMinimum);
    } else if (speed > maximum) {
      this.orb.setVelocity(Math.cos(angle) * maximum, Math.sin(angle) * maximum);
    }
  }
}
