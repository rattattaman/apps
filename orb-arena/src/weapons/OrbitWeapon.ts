import Phaser from 'phaser';
import type { Combatant } from '../combat/Combatant';
import { ARENA, SHIELD, shieldWidthForSize, WEAPONS } from '../config/balance';
import type { Segment } from '../utils/geometry';
import { progressAfterHit, progressionLabel, type WeaponProgress } from '../combat/combatLogic';

export class OrbitWeapon {
  angle: number;
  direction = 1;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private progress: WeaponProgress;
  rangeScale = 1;

  constructor(
    scene: Phaser.Scene,
    readonly owner: Combatant,
    initialAngle: number,
  ) {
    const definition = WEAPONS[owner.selection.weapon];
    this.angle = initialAngle;
    this.progress = {
      damage: definition.damage,
      range: definition.range,
      angularSpeed: definition.angularSpeed,
      burstSize: definition.initialBurstSize ?? 1,
      explosionSize: definition.initialExplosionSize ?? 0,
      shieldSize: definition.initialShieldSize ?? 0,
    };
    this.graphics = scene.add.graphics().setDepth(5);
  }

  get damage(): number { return this.progress.damage; }
  get range(): number { return this.progress.range * this.rangeScale; }
  get burstSize(): number { return this.progress.burstSize; }
  get explosionSize(): number { return this.progress.explosionSize; }
  get shieldWidth(): number { return shieldWidthForSize(this.progress.shieldSize); }
  get progressionText(): string { return progressionLabel(this.owner.selection.weapon, this.progress); }

  update(deltaSeconds: number, spinDirection: number): void {
    this.angle += this.progress.angularSpeed * this.direction * spinDirection * deltaSeconds;
    this.draw();
  }

  registerHit(): string {
    this.progress = progressAfterHit(this.owner.selection.weapon, this.progress);
    return this.progressionText;
  }

  parry(): void {
    this.direction *= -1;
    this.angle += 0.22 * this.direction;
  }

  grow(factor: number): void {
    this.rangeScale = Math.min(1.8, this.rangeScale * factor);
  }

  segment(): Segment {
    if (this.owner.selection.weapon === 'shield') return this.shieldSegment();
    const startDistance = ARENA.orbRadius - 4;
    return {
      start: {
        x: this.owner.x + Math.cos(this.angle) * startDistance,
        y: this.owner.y + Math.sin(this.angle) * startDistance,
      },
      end: {
        x: this.owner.x + Math.cos(this.angle) * (ARENA.orbRadius + this.range),
        y: this.owner.y + Math.sin(this.angle) * (ARENA.orbRadius + this.range),
      },
    };
  }

  destroy(): void {
    this.graphics.destroy();
  }

  private draw(): void {
    const type = this.owner.selection.weapon;
    const definition = WEAPONS[type];
    if (type === 'shield') {
      const segment = this.shieldSegment();
      this.graphics.clear().setPosition(segment.start.x, segment.start.y).setRotation(this.angle + Math.PI / 2)
        .lineStyle(SHIELD.thickness + 7, definition.color, 0.16)
        .beginPath().moveTo(0, 0).lineTo(this.shieldWidth, 0).strokePath()
        .lineStyle(SHIELD.thickness, definition.color, 0.95)
        .beginPath().moveTo(0, 0).lineTo(this.shieldWidth, 0).strokePath()
        .lineStyle(2, 0xeafff5, 0.8)
        .beginPath().moveTo(4, -3).lineTo(this.shieldWidth - 4, -3).strokePath();
      return;
    }
    const segment = this.segment();
    const length = Phaser.Math.Distance.Between(segment.start.x, segment.start.y, segment.end.x, segment.end.y);
    this.graphics.clear().setPosition(segment.start.x, segment.start.y).setRotation(this.angle);
    if (type === 'bow') {
      this.graphics.lineStyle(5, definition.color, 1)
        .beginPath().arc(length * 0.56, 0, 19, -1.25, 1.25, false).strokePath()
        .lineStyle(2, 0xe8e5ff, 0.75)
        .beginPath().moveTo(length * 0.56 + 6, -18).lineTo(length * 0.34, 0).lineTo(length * 0.56 + 6, 18).strokePath();
      return;
    }
    if (type === 'wand') {
      this.graphics.lineStyle(6, 0x8b543f, 1)
        .beginPath().moveTo(0, 0).lineTo(length - 8, 0).strokePath()
        .fillStyle(definition.color, 0.22).fillCircle(length, 0, 13)
        .fillStyle(0xffd39b, 1).fillCircle(length, 0, 6);
      return;
    }
    const thickness = type === 'dagger' ? 7 : type === 'spear' ? 4 : 6;
    const shaftColor = type === 'spear' ? 0xa9b5c5 : definition.color;
    this.graphics.lineStyle(thickness, shaftColor, 1)
      .beginPath().moveTo(0, 0).lineTo(length - 10, 0).strokePath();
    this.graphics.fillStyle(definition.color, 1)
      .fillTriangle(length, 0, length - (type === 'spear' ? 22 : 14), -8, length - (type === 'spear' ? 22 : 14), 8);
    if (type === 'sword') {
      this.graphics.lineStyle(5, 0xe9edf5, 1).beginPath().moveTo(4, -11).lineTo(4, 11).strokePath();
    }
  }

  private shieldSegment(): Segment {
    const radius = ARENA.orbRadius + this.range;
    const center = {
      x: this.owner.x + Math.cos(this.angle) * radius,
      y: this.owner.y + Math.sin(this.angle) * radius,
    };
    const tangentX = -Math.sin(this.angle) * this.shieldWidth / 2;
    const tangentY = Math.cos(this.angle) * this.shieldWidth / 2;
    return {
      start: { x: center.x - tangentX, y: center.y - tangentY },
      end: { x: center.x + tangentX, y: center.y + tangentY },
    };
  }
}
