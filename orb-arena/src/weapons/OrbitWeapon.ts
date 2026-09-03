import Phaser from 'phaser';
import type { Combatant } from '../combat/Combatant';
import { ARENA, CROSSOVER, HAMMER, SHIELD, shieldWidthForSize, WEAPONS } from '../config/balance';
import type { Segment } from '../utils/geometry';
import { advanceHammerSpin, copyWeaponProgress, progressAfterHit, progressAfterObstacleBounce, progressionLabel, type WeaponProgress } from '../combat/combatLogic';

export class OrbitWeapon {
  angle: number;
  direction = 1;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly satelliteGraphics: Phaser.GameObjects.Graphics;
  private readonly laserGraphics: Phaser.GameObjects.Graphics;
  private progress: WeaponProgress;
  rangeScale = 1;

  constructor(
    private readonly scene: Phaser.Scene,
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
      maxSpeed: definition.initialMaxSpeed ?? ARENA.maxSpeed,
      cutCount: definition.initialCutCount ?? 0,
      shurikenBounces: definition.initialShurikenBounces ?? 0,
      healthGain: definition.initialHealthGain ?? 1,
      chargeDamage: definition.initialChargeDamage ?? definition.damage,
      maxAngularSpeed: definition.initialMaxAngularSpeed ?? definition.angularSpeed,
      satelliteCount: definition.initialSatelliteCount ?? 0,
      sizeLevel: definition.initialSizeLevel ?? 0,
      laserCooldownMs: definition.initialLaserCooldownMs ?? 900,
    };
    this.graphics = this.scene.add.graphics().setDepth(5);
    this.satelliteGraphics = this.scene.add.graphics().setDepth(6);
    this.laserGraphics = this.scene.add.graphics().setDepth(5);
  }

  get damage(): number { return this.progress.damage; }
  get range(): number { return this.progress.range * this.rangeScale; }
  get burstSize(): number { return this.progress.burstSize; }
  get explosionSize(): number { return this.progress.explosionSize; }
  get maxSpeed(): number { return this.progress.maxSpeed; }
  get cutCount(): number { return this.progress.cutCount; }
  get shurikenBounces(): number { return this.progress.shurikenBounces ?? 0; }
  get healthGain(): number { return this.progress.healthGain ?? 1; }
  get chargeDamage(): number { return this.progress.chargeDamage ?? 1; }
  get angularSpeed(): number { return this.progress.angularSpeed; }
  get maxAngularSpeed(): number { return this.progress.maxAngularSpeed ?? this.progress.angularSpeed; }
  get satelliteCount(): number { return this.progress.satelliteCount ?? 0; }
  get sizeLevel(): number { return this.progress.sizeLevel ?? 0; }
  get laserCooldownMs(): number { return this.progress.laserCooldownMs ?? 900; }

  copyGameplayProgressFrom(other: OrbitWeapon): void {
    this.progress = copyWeaponProgress(other.progress);
    this.rangeScale = other.rangeScale;
  }
  get shieldWidth(): number { return shieldWidthForSize(this.progress.shieldSize); }
  get progressionText(): string { return progressionLabel(this.owner.selection.weapon, this.progress); }

  update(deltaSeconds: number, spinDirection: number): void {
    if (this.owner.selection.weapon === 'hammer') {
      this.progress.angularSpeed = advanceHammerSpin(this.progress.angularSpeed, this.maxAngularSpeed, HAMMER.spinAcceleration, deltaSeconds);
    }
    this.angle += this.progress.angularSpeed * this.direction * spinDirection * deltaSeconds;
    this.draw();
  }

  registerHit(): string {
    this.progress = progressAfterHit(this.owner.selection.weapon, this.progress);
    return this.progressionText;
  }

  registerObstacleBounce(): string {
    this.progress = progressAfterObstacleBounce(this.owner.selection.weapon, this.progress);
    return this.progressionText;
  }

  satellitePositions(): Array<{ x: number; y: number }> {
    const count = this.satelliteCount;
    if (count <= 0) return [];
    return Array.from({ length: count }, (_, index) => {
      const angle = this.angle + index * Math.PI * 2 / count;
      return {
        x: this.owner.x + Math.cos(angle) * CROSSOVER.satelliteOrbitDistance,
        y: this.owner.y + Math.sin(angle) * CROSSOVER.satelliteOrbitDistance,
      };
    });
  }

  parry(): string | null {
    this.direction *= -1;
    this.angle += 0.22 * this.direction;
    if (this.owner.selection.weapon !== 'katana') return null;
    return this.registerHit();
  }

  grow(factor: number): void {
    this.rangeScale = Math.min(1.8, this.rangeScale * factor);
  }

  segment(): Segment {
    if (this.owner.selection.weapon === 'shield') return this.shieldSegment();
    if (this.owner.selection.weapon === 'laser') return this.laserSegment();
    return this.radialSegment();
  }

  private radialSegment(): Segment {
    const startDistance = this.owner.radius - 4;
    return {
      start: {
        x: this.owner.x + Math.cos(this.angle) * startDistance,
        y: this.owner.y + Math.sin(this.angle) * startDistance,
      },
      end: {
        x: this.owner.x + Math.cos(this.angle) * (this.owner.radius + this.range),
        y: this.owner.y + Math.sin(this.angle) * (this.owner.radius + this.range),
      },
    };
  }

  destroy(): void {
    this.graphics.destroy();
    this.satelliteGraphics.destroy();
    this.laserGraphics.destroy();
  }

  private draw(): void {
    this.drawSatellites();
    this.drawLaserAbility();
    const type = this.owner.visualWeaponType;
    const definition = WEAPONS[type];
    if (type === 'unarmed' || type === 'crusher' || type === 'orbit' || type === 'giant' || type === 'laser') {
      this.graphics.clear();
      return;
    }
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
    const segment = this.radialSegment();
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
    if (type === 'scythe') {
      this.graphics.lineStyle(5, 0x7d8791, 1)
        .beginPath().moveTo(0, 0).lineTo(length - 8, 0).strokePath()
        .lineStyle(8, definition.color, 0.95)
        .beginPath().arc(length - 8, -15, 20, -0.15, 1.65, false).strokePath()
        .lineStyle(2, 0xeaffd7, 0.8)
        .beginPath().arc(length - 8, -15, 16, -0.1, 1.55, false).strokePath();
      return;
    }
    if (type === 'wrench') {
      this.graphics.lineStyle(8, 0x7f8b98, 1).beginPath().moveTo(2, 0).lineTo(length - 15, 0).strokePath()
        .fillStyle(0x26303a, 1).fillCircle(7, 0, 4)
        .lineStyle(6, definition.color, 1).beginPath()
        .moveTo(length - 18, -12).lineTo(length - 7, -5).lineTo(length - 2, 0)
        .lineTo(length - 7, 5).lineTo(length - 18, 12).strokePath()
        .lineStyle(2, 0xf4f7fa, 0.85).beginPath().moveTo(13, -2).lineTo(length - 18, -2).strokePath();
      return;
    }
    if (type === 'katana') {
      this.graphics.lineStyle(6, 0x372334, 1).beginPath().moveTo(-4, 0).lineTo(13, 0).strokePath()
        .lineStyle(5, definition.color, 1).beginPath().moveTo(12, 0).lineTo(length - 5, 0).strokePath()
        .lineStyle(2, 0xffffff, 0.95).beginPath().moveTo(15, -2).lineTo(length - 5, -2).lineTo(length, 0).strokePath()
        .lineStyle(5, 0xe7b7d2, 1).beginPath().moveTo(10, -9).lineTo(10, 9).strokePath();
      return;
    }
    if (type === 'joust') {
      this.graphics.fillStyle(0x8f6b3d, 1).fillRect(0, -4, length - 17, 8)
        .lineStyle(3, 0xffefbd, 0.9).beginPath().moveTo(5, -2).lineTo(length - 18, -2).strokePath()
        .fillStyle(definition.color, 1).fillTriangle(length, 0, length - 22, -11, length - 22, 11)
        .lineStyle(5, 0x8f6b3d, 1).beginPath().moveTo(12, -12).lineTo(12, 12).strokePath();
      return;
    }
    if (type === 'shuriken') {
      const center = length - 5;
      this.graphics.lineStyle(4, definition.color, 1).beginPath().moveTo(0, 0).lineTo(center - 10, 0).strokePath()
        .fillStyle(0xcbd5ff, 1)
        .fillTriangle(center, -15, center + 5, -4, center - 5, -4)
        .fillTriangle(center + 15, 0, center + 4, 5, center + 4, -5)
        .fillTriangle(center, 15, center - 5, 4, center + 5, 4)
        .fillTriangle(center - 15, 0, center - 4, -5, center - 4, 5)
        .fillStyle(0x27314c, 1).fillCircle(center, 0, 4);
      return;
    }
    if (type === 'grimoire') {
      const bookX = length - 22;
      const visualColor = this.owner.visualColor;
      this.graphics.lineStyle(4, visualColor, 1).beginPath().moveTo(0, 0).lineTo(bookX, 0).strokePath()
        .fillStyle(0x392653, 1).fillRoundedRect(bookX, -15, 30, 30, 4)
        .lineStyle(3, visualColor, 1).strokeRoundedRect(bookX, -15, 30, 30, 4)
        .lineStyle(2, 0xf0dfff, 0.9).beginPath().moveTo(bookX + 15, -12).lineTo(bookX + 15, 12).strokePath()
        .fillStyle(0xf0dfff, 1).fillCircle(bookX + 8, 0, 3);
      return;
    }
    if (type === 'scepter') {
      this.graphics.lineStyle(7, 0x8c6938, 1).beginPath().moveTo(0, 0).lineTo(length - 10, 0).strokePath()
        .lineStyle(3, 0xfff2bd, 0.85).beginPath().moveTo(4, -2).lineTo(length - 12, -2).strokePath()
        .fillStyle(definition.color, 1).fillCircle(length - 5, 0, 11)
        .lineStyle(3, 0xffffff, 0.9).strokeCircle(length - 5, 0, 7)
        .fillStyle(0xfff4bc, 1).fillCircle(length - 7, -2, 3);
      return;
    }
    if (type === 'bottle') {
      const vialX = length - 18;
      this.graphics.lineStyle(4, 0xa9bac0, 1).beginPath().moveTo(0, 0).lineTo(vialX, 0).strokePath()
        .fillStyle(0xc8f7d0, 0.9).fillRoundedRect(vialX, -12, 25, 24, 5)
        .fillStyle(definition.color, 0.9).fillRect(vialX + 4, 0, 17, 8)
        .fillStyle(0x6f4c2f, 1).fillRect(vialX + 8, -17, 9, 7)
        .lineStyle(2, 0xffffff, 0.8).strokeRoundedRect(vialX, -12, 25, 24, 5);
      return;
    }
    if (type === 'hammer') {
      const headX = length - 24;
      this.graphics.lineStyle(8, 0x8b6747, 1).beginPath().moveTo(0, 0).lineTo(headX + 12, 0).strokePath()
        .fillStyle(0x526676, 1).fillRoundedRect(headX, -17, 30, 34, 4)
        .lineStyle(3, definition.color, 1).strokeRoundedRect(headX, -17, 30, 34, 4)
        .lineStyle(2, 0xdff4ff, 0.8).beginPath().moveTo(headX + 5, -12).lineTo(headX + 24, -12).strokePath();
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

  private drawSatellites(): void {
    this.satelliteGraphics.clear();
    if (this.owner.selection.weapon !== 'orbit') return;
    for (const position of this.satellitePositions()) {
      this.satelliteGraphics.fillStyle(this.owner.visualColor, 0.2)
        .fillCircle(position.x, position.y, CROSSOVER.satelliteRadius + 4)
        .fillStyle(0xdffaff, 1)
        .fillCircle(position.x, position.y, CROSSOVER.satelliteRadius)
        .lineStyle(2, this.owner.visualColor, 0.95)
        .strokeCircle(position.x, position.y, CROSSOVER.satelliteRadius);
    }
  }

  private drawLaserAbility(): void {
    this.laserGraphics.clear();
    if (this.owner.selection.weapon !== 'laser') return;
    const segment = this.laserSegment();
    const length = Phaser.Math.Distance.Between(segment.start.x, segment.start.y, segment.end.x, segment.end.y);
    this.laserGraphics.setPosition(segment.start.x, segment.start.y).setRotation(this.angle)
      .lineStyle(13, this.owner.visualColor, 0.12)
      .beginPath().moveTo(0, 0).lineTo(length, 0).strokePath()
      .lineStyle(5, this.owner.visualColor, 0.9)
      .beginPath().moveTo(0, 0).lineTo(length, 0).strokePath()
      .lineStyle(2, 0xffffff, 0.95)
      .beginPath().moveTo(0, 0).lineTo(length, 0).strokePath()
      .fillStyle(0xffffff, 0.95).fillCircle(length, 0, 4);
  }

  private laserSegment(): Segment {
    const arenaDiagonal = Math.hypot(this.scene.scale.width, this.scene.scale.height);
    return {
      start: { x: this.owner.x, y: this.owner.y },
      end: {
        x: this.owner.x + Math.cos(this.angle) * arenaDiagonal,
        y: this.owner.y + Math.sin(this.angle) * arenaDiagonal,
      },
    };
  }

  private shieldSegment(): Segment {
    const radius = this.owner.radius + this.range;
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
