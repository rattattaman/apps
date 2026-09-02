import Phaser from 'phaser';
import { SoundEngine } from '../audio/SoundEngine';
import { COLLISION, Combatant } from '../combat/Combatant';
import { burstShotDelays, ContactCooldowns, growSlimeDps } from '../combat/combatLogic';
import { canCreateClone, cloneHealthForNumber, createCloneIdentity } from '../combat/cloneLogic';
import { resolveArenaWallContact } from '../combat/physicsLogic';
import { ARENA, arenaSizeForFighterCount, BOTTLE, CHAOS, CROSSOVER, DEFAULT_FIGHTERS, FIREBALL, fireballExplosionRadius, JOUST, KATANA, PROJECTILES, SHIELD, SHURIKEN, SLIME, TURRET, UNARMED } from '../config/balance';
import { gameEvents } from '../events';
import { ChaosController, type ChaosHost } from '../modifiers/ChaosController';
import { Projectile } from '../projectiles/Projectile';
import type { BattleConfig } from '../types';
import { pointToSegmentDistanceSquared, segmentDistanceSquared } from '../utils/geometry';
import { SeededRandom } from '../utils/seededRandom';

interface CollisionPair {
  bodyA: MatterJS.BodyType;
  bodyB: MatterJS.BodyType;
}

interface CollisionEvent {
  pairs: CollisionPair[];
}

interface PoisonEffect {
  source: Combatant;
  nextTickAt: number;
}

interface TurretState {
  owner: Combatant;
  sprite: Phaser.Physics.Matter.Image;
  angle: number;
  nextShotAt: number;
}

interface SlimeZone {
  owner: Combatant;
  sprite: Phaser.GameObjects.Arc;
  dps: number;
  expiresAt: number;
  nextTickAt: number;
  nextGrowthAt: number;
}

const PREVIEW_CONFIG: BattleConfig = {
  seed: 'ORB-ARENA', startingHealth: 100, chaosMode: false, fighters: DEFAULT_FIGHTERS,
};

export class BattleScene extends Phaser.Scene implements ChaosHost {
  private fighters: Combatant[] = [];
  private projectiles: Projectile[] = [];
  private turrets: TurretState[] = [];
  private slimeZones: SlimeZone[] = [];
  private walls: MatterJS.BodyType[] = [];
  private readonly cooldowns = new ContactCooldowns();
  private readonly audio = new SoundEngine();
  private random = new SeededRandom(PREVIEW_CONFIG.seed);
  private battleConfig: BattleConfig = PREVIEW_CONFIG;
  private chaosController: ChaosController | null = null;
  private arenaSize: number = ARENA.width;
  private arenaInset: number = ARENA.padding;
  private spinDirection = 1;
  private projectileMultiplier = 1;
  private bounceHealing = false;
  private suddenDeath = false;
  private globalSpeed = 1;
  private particlesEnabled = true;
  private simulationSpeed = 1;
  private startedAt = 0;
  private ending = false;
  private projectileSequence = 0;
  private nextHudAt = 0;
  private nextShrinkAt = ARENA.battleLimitMs + 8_000;
  private readonly nextShotAt = new Map<string, number>();
  private readonly joustNextCharge = new Map<string, number>();
  private readonly joustCharging = new Set<string>();
  private readonly joustChargeAngles = new Map<string, number>();
  private readonly lastBounceHealAt = new Map<string, number>();
  private readonly poisonEffects = new Map<string, PoisonEffect>();
  private readonly cloneCountsByOwner = new Map<string, number>();
  private nextEntitySequence = 0;
  private arenaBorder!: Phaser.GameObjects.Graphics;

  constructor() {
    super('battle');
  }

  create(): void {
    this.resetState();
    this.cameras.main.setSize(this.arenaSize, this.arenaSize);
    this.createTextures();
    this.arenaBorder = this.add.graphics().setDepth(1);
    this.createWalls();
    this.createFighters();
    this.createTurrets();
    this.matter.world.on('collisionstart', this.onCollisionStart, this);
    this.matter.world.on('afterupdate', this.resolveWallContacts, this);
    this.startedAt = this.time.now;
    if (this.battleConfig.chaosMode) this.chaosController = new ChaosController(this, this.random);
    this.emitHud(true);
    gameEvents.emit('battle:started', this.battleConfig);
  }

  update(time: number, delta: number): void {
    const deltaSeconds = Math.min(delta, 34) / 1000;
    if (this.ending) {
      this.updateProjectiles(time);
      return;
    }
    const elapsed = time - this.startedAt;
    for (const fighter of this.fighters) fighter.update(deltaSeconds, this.spinDirection, this.globalSpeed);
    this.updateTurrets(time, deltaSeconds);
    this.steerTowardRivals(deltaSeconds);
    this.updateMeleeCombat(time);
    this.updateSatelliteCombat(time);
    this.updateJoust(time);
    this.updateParries(time);
    this.updateRangedWeapons(time);
    this.updateProjectiles(time);
    this.updateSlimeZones(time);
    this.updatePoison(time);
    this.chaosController?.update(elapsed);
    this.preventEndlessBattle(elapsed);
    if (time >= this.nextHudAt) this.emitHud();
  }

  togglePause(): boolean {
    if (this.scene.isPaused()) {
      this.scene.resume();
      return false;
    }
    this.scene.pause();
    return true;
  }

  restartBattle(): void {
    this.scene.restart();
  }

  setSimulationSpeed(speed: number): void {
    this.simulationSpeed = speed;
    this.matter.world.engine.timing.timeScale = speed;
    this.time.timeScale = speed;
    this.tweens.timeScale = speed;
  }

  setMuted(muted: boolean): void {
    this.audio.setMuted(muted);
  }

  setParticles(enabled: boolean): void {
    this.particlesEnabled = enabled;
  }

  announceChaos(name: string, detail: string): void {
    gameEvents.emit('battle:event', { kind: 'chaos', title: name, detail });
    this.cameras.main.flash(180, 100, 68, 170, false);
  }

  shrinkArena(amount: number): void {
    this.arenaInset = Math.min(CHAOS.maxArenaInset, this.arenaInset + amount);
    this.createWalls();
  }

  setTemporaryGravity(x: number, y: number, durationMs: number): void {
    this.matter.world.setGravity(x, y);
    this.time.delayedCall(durationMs, () => this.matter.world.setGravity(0, 0));
  }

  growWeapons(factor: number): void {
    for (const fighter of this.aliveFighters()) fighter.weapon.grow(factor);
    this.emitHud(true);
  }

  setProjectileMultiplier(multiplier: number, durationMs: number): void {
    this.projectileMultiplier = multiplier;
    this.time.delayedCall(durationMs, () => { this.projectileMultiplier = 1; });
  }

  reverseSpin(): void {
    this.spinDirection *= -1;
  }

  setBounceHealing(enabled: boolean, durationMs: number): void {
    this.bounceHealing = enabled;
    this.time.delayedCall(durationMs, () => { this.bounceHealing = false; });
  }

  activateSuddenDeath(): void {
    if (this.suddenDeath) return;
    this.suddenDeath = true;
    gameEvents.emit('battle:event', { kind: 'warning', title: 'MUERTE SÚBITA', detail: 'Daño ×2 · la arena seguirá cerrándose' });
  }

  increaseGlobalSpeed(factor: number): void {
    this.globalSpeed = Math.min(1.9, this.globalSpeed * factor);
    for (const fighter of this.aliveFighters()) {
      const body = fighter.orb.body as MatterJS.BodyType;
      fighter.orb.setVelocity(body.velocity.x * factor, body.velocity.y * factor);
    }
  }

  private resetState(): void {
    this.battleConfig = (this.registry.get('battleConfig') as BattleConfig | undefined) ?? PREVIEW_CONFIG;
    this.arenaSize = arenaSizeForFighterCount(this.battleConfig.fighters.length);
    this.simulationSpeed = (this.registry.get('simulationSpeed') as number | undefined) ?? 1;
    this.particlesEnabled = (this.registry.get('particlesEnabled') as boolean | undefined) ?? true;
    this.audio.setMuted((this.registry.get('muted') as boolean | undefined) ?? false);
    this.random = new SeededRandom(this.battleConfig.seed);
    this.fighters = [];
    this.projectiles = [];
    this.turrets = [];
    this.slimeZones = [];
    this.walls = [];
    this.chaosController = null;
    this.arenaInset = ARENA.padding;
    this.spinDirection = 1;
    this.projectileMultiplier = 1;
    this.bounceHealing = false;
    this.suddenDeath = false;
    this.globalSpeed = 1;
    this.ending = false;
    this.projectileSequence = 0;
    this.nextEntitySequence = this.battleConfig.fighters.length;
    this.nextHudAt = 0;
    this.nextShrinkAt = ARENA.battleLimitMs + 8_000;
    this.nextShotAt.clear();
    this.joustNextCharge.clear();
    this.joustCharging.clear();
    this.joustChargeAngles.clear();
    this.lastBounceHealAt.clear();
    this.poisonEffects.clear();
    this.cloneCountsByOwner.clear();
    this.matter.world.setGravity(0, 0);
    this.matter.world.engine.timing.timeScale = this.simulationSpeed;
  }

  private createTextures(): void {
    if (!this.textures.exists('orb')) {
      const graphics = this.make.graphics({ x: 0, y: 0 });
      graphics.fillStyle(0xffffff).fillCircle(32, 32, ARENA.orbRadius);
      graphics.lineStyle(3, 0xffffff, 0.65).strokeCircle(32, 32, ARENA.orbRadius - 2);
      graphics.generateTexture('orb', 64, 64);
      graphics.destroy();
    }
    if (!this.textures.exists('arrow')) {
      const graphics = this.make.graphics({ x: 0, y: 0 });
      graphics.fillStyle(0xe9e5ff).fillRect(0, 3, 25, 3).fillTriangle(34, 4, 23, 0, 23, 8);
      graphics.generateTexture('arrow', 36, 9);
      graphics.destroy();
    }
    if (!this.textures.exists('fireball')) {
      const graphics = this.make.graphics({ x: 0, y: 0 });
      graphics.fillStyle(0xff5a28, 0.22).fillCircle(14, 14, 14);
      graphics.fillStyle(0xff7a32, 0.85).fillCircle(14, 14, 10);
      graphics.fillStyle(0xffdc7a, 1).fillCircle(12, 12, 5);
      graphics.generateTexture('fireball', 28, 28);
      graphics.destroy();
    }
    if (!this.textures.exists('bolt')) {
      const graphics = this.make.graphics({ x: 0, y: 0 });
      graphics.fillStyle(0x92ddff, 1).fillRect(2, 4, 22, 4);
      graphics.fillStyle(0xe9f9ff, 1).fillTriangle(31, 6, 22, 1, 22, 11);
      graphics.generateTexture('bolt', 32, 12);
      graphics.destroy();
    }
    if (!this.textures.exists('shuriken')) {
      const graphics = this.make.graphics({ x: 0, y: 0 });
      graphics.fillStyle(0xcbd5ff, 1)
        .fillTriangle(12, 0, 16, 9, 8, 9)
        .fillTriangle(24, 12, 15, 16, 15, 8)
        .fillTriangle(12, 24, 8, 15, 16, 15)
        .fillTriangle(0, 12, 9, 8, 9, 16)
        .fillStyle(0x27314c, 1).fillCircle(12, 12, 4);
      graphics.generateTexture('shuriken', 24, 24);
      graphics.destroy();
    }
    if (!this.textures.exists('bottle')) {
      const graphics = this.make.graphics({ x: 0, y: 0 });
      graphics.fillStyle(0xdaf7df, 0.95).fillRoundedRect(4, 7, 16, 18, 5)
        .fillStyle(0x68e072, 1).fillRect(6, 15, 12, 8)
        .fillStyle(0x704b2f, 1).fillRect(8, 2, 8, 7)
        .lineStyle(2, 0xffffff, 0.85).strokeRoundedRect(4, 7, 16, 18, 5);
      graphics.generateTexture('bottle', 24, 28);
      graphics.destroy();
    }
    if (!this.textures.exists('turret')) {
      const graphics = this.make.graphics({ x: 0, y: 0 });
      graphics.fillStyle(0x28303b, 1).fillCircle(32, 32, TURRET.radius);
      graphics.lineStyle(5, 0xf0a04b, 0.9).strokeCircle(32, 32, TURRET.radius - 4);
      graphics.fillStyle(0xb9c6d3, 1).fillRect(29, 8, 7, 27);
      graphics.fillStyle(0xeff7ff, 0.9).fillCircle(32, 32, 7);
      graphics.generateTexture('turret', 64, 64);
      graphics.destroy();
    }
  }

  private createFighters(): void {
    const positions = this.spawnPositions(this.battleConfig.fighters.length);
    this.fighters = this.battleConfig.fighters.map((selection, index) => {
      const position = positions[index] as { x: number; y: number };
      const fighter = new Combatant(
        this, selection, index, position.x, position.y,
        this.battleConfig.startingHealth, this.random.between(0, Math.PI * 2),
      );
      const heading = this.random.between(0, Math.PI * 2);
      const speed = this.random.between(3.2, 4.5);
      fighter.orb.setVelocity(Math.cos(heading) * speed, Math.sin(heading) * speed);
      this.nextShotAt.set(fighter.id, this.time.now + this.random.between(700, PROJECTILES.fireIntervalMs));
      if (selection.weapon === 'joust') this.scheduleNextJoust(fighter, this.time.now);
      return fighter;
    });
  }

  private createTurrets(): void {
    this.turrets = [];
    for (const owner of this.fighters.filter((fighter) => fighter.selection.weapon === 'wrench')) {
      this.spawnTurret(owner);
    }
  }

  private spawnTurret(owner: Combatant): void {
    const inset = ARENA.padding + TURRET.radius + 4;
    const ownerTurrets = this.turrets.filter((turret) => turret.owner === owner).length;
    const towardCenter = Math.atan2(this.arenaSize / 2 - owner.y, this.arenaSize / 2 - owner.x);
    const placementAngle = towardCenter + ownerTurrets * 2.39996;
    const x = Phaser.Math.Clamp(
      owner.x + Math.cos(placementAngle) * TURRET.placementDistance,
      inset,
      this.arenaSize - inset,
    );
    const y = Phaser.Math.Clamp(
      owner.y + Math.sin(placementAngle) * TURRET.placementDistance,
      inset,
      this.arenaSize - inset,
    );
    const sprite = this.matter.add.image(x, y, 'turret', undefined, {
      shape: { type: 'circle', radius: TURRET.radius },
      isStatic: true,
      restitution: 1,
      friction: 0,
      label: `turret-${this.turrets.length}`,
    });
    sprite.setCollisionCategory(COLLISION.turret).setCollidesWith(COLLISION.fighter).setDepth(4);
    this.turrets.push({
      owner,
      sprite,
      angle: this.random.between(0, Math.PI * 2),
      nextShotAt: this.time.now + this.random.between(450, TURRET.fireIntervalMs),
    });
    this.spark(x, y, owner.visualColor, 10);
  }

  private updateTurrets(now: number, deltaSeconds: number): void {
    for (const turret of this.turrets) {
      turret.angle += TURRET.angularSpeed * this.spinDirection * deltaSeconds;
      turret.sprite.setRotation(turret.angle + Math.PI / 2);
      if (now < turret.nextShotAt) continue;
      turret.nextShotAt = now + TURRET.fireIntervalMs;
      const count = this.projectileMultiplier;
      for (let index = 0; index < count; index += 1) {
        const offset = count === 1 ? 0 : (index - (count - 1) / 2) * 0.11;
        const angle = turret.angle + offset;
        const distance = TURRET.radius + 12;
        this.projectiles.push(new Projectile(
          this,
          turret.owner,
          TURRET.projectileDamage,
          turret.sprite.x + Math.cos(angle) * distance,
          turret.sprite.y + Math.sin(angle) * distance,
          angle,
          this.projectileSequence++,
          'bolt',
        ));
      }
      this.audio.shot();
    }
  }

  private spawnPositions(count: number): Array<{ x: number; y: number }> {
    const left = this.arenaSize * 0.25;
    const right = this.arenaSize * 0.75;
    const centerX = this.arenaSize * 0.5;
    const top = this.arenaSize * 0.25;
    const bottom = this.arenaSize * 0.75;
    const centerY = this.arenaSize * 0.5;
    const all = count === 2
      ? [{ x: left, y: centerY }, { x: right, y: centerY }]
      : count === 3
        ? [{ x: left, y: top }, { x: right, y: top }, { x: centerX, y: bottom }]
        : count === 4
          ? [{ x: left, y: top }, { x: right, y: top }, { x: left, y: bottom }, { x: right, y: bottom }]
          : Array.from({ length: count }, (_, index) => {
            const angle = -Math.PI / 2 + index * Math.PI * 2 / count;
            const radius = this.arenaSize * 0.3;
            return { x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius };
          });
    return all.map((position) => ({
      x: position.x + this.random.between(-28, 28),
      y: position.y + this.random.between(-24, 24),
    }));
  }

  private createWalls(): void {
    for (const wall of this.walls) this.matter.world.remove(wall);
    const thickness = 50;
    const inset = this.arenaInset;
    const innerWidth = this.arenaSize - inset * 2;
    const innerHeight = this.arenaSize - inset * 2;
    const options = { isStatic: true, restitution: 1, friction: 0, label: 'arena-wall' };
    this.walls = [
      this.matter.add.rectangle(inset - thickness / 2, this.arenaSize / 2, thickness, innerHeight + thickness * 2, options),
      this.matter.add.rectangle(this.arenaSize - inset + thickness / 2, this.arenaSize / 2, thickness, innerHeight + thickness * 2, options),
      this.matter.add.rectangle(this.arenaSize / 2, inset - thickness / 2, innerWidth, thickness, options),
      this.matter.add.rectangle(this.arenaSize / 2, this.arenaSize - inset + thickness / 2, innerWidth, thickness, options),
    ];
    for (const wall of this.walls) {
      wall.collisionFilter.category = COLLISION.wall;
      wall.collisionFilter.mask = COLLISION.fighter;
    }
    if (this.arenaBorder) {
      this.arenaBorder.clear().lineStyle(2, 0x9aa7bd, 0.28)
        .strokeRect(inset, inset, innerWidth, innerHeight);
    }
    for (const fighter of this.aliveFighters()) {
      fighter.orb.setPosition(
        Phaser.Math.Clamp(fighter.x, inset + ARENA.orbRadius, this.arenaSize - inset - ARENA.orbRadius),
        Phaser.Math.Clamp(fighter.y, inset + ARENA.orbRadius, this.arenaSize - inset - ARENA.orbRadius),
      );
    }
  }

  private updateMeleeCombat(now: number): void {
    const alive = this.aliveFighters();
    for (const attacker of alive) {
      if (!attacker.alive) continue;
      if (['bow', 'wand', 'shield', 'unarmed', 'shuriken', 'bottle', 'crusher', 'orbit'].includes(attacker.selection.weapon)) continue;
      const segment = attacker.weapon.segment();
      for (const target of alive) {
        if (target === attacker || !target.alive) continue;
        if (target.selection.weapon === 'shield'
          && segmentDistanceSquared(segment, target.weapon.segment()) <= (SHIELD.thickness + 5) ** 2) {
          if (this.cooldowns.canTrigger(`shield-${target.id}`, attacker.id, now, ARENA.weaponHitCooldownMs)) {
            const impact = target.weapon.segment().start;
            if (attacker.selection.weapon === 'katana') {
              this.showWeaponProgress(attacker, attacker.weapon.registerHit());
            }
            this.applyReflectedDamage(target, attacker, attacker.weapon.damage, impact.x, impact.y);
          }
          continue;
        }
        const hitRadius = target.radius + 7;
        if (pointToSegmentDistanceSquared(target, segment) > hitRadius * hitRadius) continue;
        if (!this.cooldowns.canTrigger(attacker.id, target.id, now, ARENA.weaponHitCooldownMs)) continue;
        if (attacker.selection.weapon === 'katana') {
          this.applyKatanaStrike(attacker, target, segment.end.x, segment.end.y);
          continue;
        }
        const charging = attacker.selection.weapon === 'joust' && this.joustCharging.has(attacker.id);
        const hitDamage = charging
          ? attacker.weapon.chargeDamage
          : attacker.selection.weapon === 'hammer' ? attacker.weapon.angularSpeed : attacker.weapon.damage;
        const knockback = attacker.selection.weapon === 'spear' ? 2.5 : charging ? 2.8 : 1.05;
        this.applyDamage(attacker, target, hitDamage, knockback, segment.end.x, segment.end.y, !charging);
        if (attacker.selection.weapon === 'scythe' && target.alive) this.applyPoison(attacker, target);
      }
    }
  }

  private updateSatelliteCombat(now: number): void {
    const alive = this.aliveFighters();
    for (const attacker of alive) {
      if (attacker.selection.weapon !== 'orbit') continue;
      const satellites = attacker.weapon.satellitePositions();
      for (let index = 0; index < satellites.length; index += 1) {
        const satellite = satellites[index] as { x: number; y: number };
        for (const target of alive) {
          if (target === attacker || !target.alive) continue;
          const hitRadius = target.radius + CROSSOVER.satelliteRadius;
          if (Phaser.Math.Distance.Squared(satellite.x, satellite.y, target.x, target.y) > hitRadius ** 2) continue;
          if (!this.cooldowns.canTrigger(`${attacker.id}-orbit-${index}`, target.id, now, ARENA.weaponHitCooldownMs)) continue;
          this.applyDamage(attacker, target, 1, 0.65, satellite.x, satellite.y, false);
        }
      }
    }
  }

  private updateJoust(now: number): void {
    for (const fighter of this.aliveFighters()) {
      if (fighter.selection.weapon !== 'joust') continue;
      if (this.joustCharging.has(fighter.id)) {
        const angle = this.joustChargeAngles.get(fighter.id) ?? fighter.weapon.angle;
        fighter.orb.setVelocity(Math.cos(angle) * JOUST.chargeSpeed, Math.sin(angle) * JOUST.chargeSpeed);
        continue;
      }
      const next = this.joustNextCharge.get(fighter.id);
      if (next === undefined) { this.scheduleNextJoust(fighter, now); continue; }
      if (now < next) continue;
      const target = this.nearestRival(fighter); if (!target) continue;
      const angle = Math.atan2(target.y - fighter.y, target.x - fighter.x);
      this.joustCharging.add(fighter.id);
      this.joustChargeAngles.set(fighter.id, angle);
      this.joustNextCharge.delete(fighter.id);
      fighter.setInvulnerable(true);
      fighter.orb.setVelocity(Math.cos(angle) * JOUST.chargeSpeed, Math.sin(angle) * JOUST.chargeSpeed);
      this.spark(fighter.x, fighter.y, fighter.visualColor, 12);
      gameEvents.emit('battle:event', { kind: 'hit', title: `${fighter.displayName} EMBISTE`, detail: `${fighter.weapon.chargeDamage} de daño hasta chocar` });
    }
  }

  private scheduleNextJoust(fighter: Combatant, now: number): void {
    this.joustNextCharge.set(fighter.id, now + this.random.between(JOUST.minChargeDelayMs, JOUST.maxChargeDelayMs));
  }

  private stopJoustCharge(fighter: Combatant): void {
    if (!this.joustCharging.delete(fighter.id)) return;
    this.joustChargeAngles.delete(fighter.id);
    fighter.setInvulnerable(false);
    this.scheduleNextJoust(fighter, this.time.now);
    this.spark(fighter.x, fighter.y, fighter.visualColor, 7);
  }

  private updateParries(now: number): void {
    const alive = this.aliveFighters();
    for (let firstIndex = 0; firstIndex < alive.length; firstIndex += 1) {
      const first = alive[firstIndex] as Combatant;
      for (let secondIndex = firstIndex + 1; secondIndex < alive.length; secondIndex += 1) {
        const second = alive[secondIndex] as Combatant;
        if (['shield', 'unarmed', 'crusher', 'orbit'].includes(first.selection.weapon)
          || ['shield', 'unarmed', 'crusher', 'orbit'].includes(second.selection.weapon)) continue;
        if (segmentDistanceSquared(first.weapon.segment(), second.weapon.segment()) > 100) continue;
        if (!this.cooldowns.canTrigger(`parry-${first.id}`, second.id, now, ARENA.parryCooldownMs)) continue;
        const firstProgress = first.weapon.parry();
        const secondProgress = second.weapon.parry();
        if (firstProgress) this.showWeaponProgress(first, firstProgress);
        if (secondProgress) this.showWeaponProgress(second, secondProgress);
        const angle = Math.atan2(second.y - first.y, second.x - first.x);
        this.addVelocity(first, angle + Math.PI, 0.6);
        this.addVelocity(second, angle, 0.6);
        const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
        this.spark(midpoint.x, midpoint.y, 0xeef6ff, 5);
        this.audio.parry();
        gameEvents.emit('battle:event', { kind: 'parry', title: 'PARADA', detail: `${first.displayName} ↔ ${second.displayName}` });
      }
    }
  }

  private updateRangedWeapons(now: number): void {
    for (const fighter of this.aliveFighters()) {
      if (!['bow', 'wand', 'shuriken', 'bottle'].includes(fighter.selection.weapon)) continue;
      if (now < (this.nextShotAt.get(fighter.id) ?? 0)) continue;
      const target = this.nearestRival(fighter);
      if (!target) continue;
      const targetAngle = Math.atan2(target.y - fighter.y, target.x - fighter.x);
      const alignment = Math.abs(Phaser.Math.Angle.Wrap(fighter.weapon.angle - targetAngle));
      if (alignment > 0.42) {
        this.nextShotAt.set(fighter.id, now + 90);
        continue;
      }
      if (fighter.selection.weapon === 'wand') {
        this.nextShotAt.set(fighter.id, now + FIREBALL.fireIntervalMs);
        const count = this.projectileMultiplier;
        for (let index = 0; index < count; index += 1) {
          const offset = count === 1 ? 0 : (index - (count - 1) / 2) * 0.1;
          const start = fighter.weapon.segment().end;
          this.projectiles.push(new Projectile(
            this, fighter, fighter.weapon.damage, start.x, start.y,
            fighter.weapon.angle + offset, this.projectileSequence++, 'fireball', fighter.weapon.explosionSize,
          ));
        }
        this.audio.shot();
        continue;
      }
      if (fighter.selection.weapon === 'shuriken') {
        this.nextShotAt.set(fighter.id, now + SHURIKEN.fireIntervalMs);
        const start = fighter.weapon.segment().end;
        this.projectiles.push(new Projectile(this, fighter, fighter.weapon.damage, start.x, start.y, fighter.weapon.angle, this.projectileSequence++, 'shuriken', 0, Math.floor(fighter.weapon.shurikenBounces)));
        this.audio.shot();
        continue;
      }
      if (fighter.selection.weapon === 'bottle') {
        this.nextShotAt.set(fighter.id, now + BOTTLE.fireIntervalMs);
        const start = fighter.weapon.segment().end;
        this.projectiles.push(new Projectile(this, fighter, 0, start.x, start.y, fighter.weapon.angle, this.projectileSequence++, 'bottle'));
        this.audio.shot();
        continue;
      }
      const count = Math.min(PROJECTILES.maxBurst, fighter.weapon.burstSize) * this.projectileMultiplier;
      this.nextShotAt.set(
        fighter.id,
        now + PROJECTILES.fireIntervalMs + Math.max(0, count - 1) * PROJECTILES.burstSpacingMs,
      );
      const spread = count === 1
        ? 0
        : Math.min(PROJECTILES.maxBurstSpread, PROJECTILES.burstAngleSpacing * (count - 1));
      const shotDelays = burstShotDelays(count, PROJECTILES.burstSpacingMs);
      for (let index = 0; index < count; index += 1) {
        const offset = count === 1 ? 0 : -spread / 2 + (spread * index) / (count - 1);
        this.time.delayedCall(shotDelays[index] as number, () => {
          if (!fighter.alive || this.ending) return;
          const start = fighter.weapon.segment().end;
          this.projectiles.push(new Projectile(
            this, fighter, fighter.weapon.damage, start.x, start.y,
            fighter.weapon.angle + offset, this.projectileSequence++,
          ));
          this.audio.shot();
        });
      }
    }
  }

  private updateProjectiles(now: number): void {
    const inset = this.arenaInset;
    for (const projectile of this.projectiles) {
      projectile.update(now);
      if (!projectile.alive) continue;
      if (projectile.shouldBreakBottle()) {
        this.spawnSlime(projectile.owner, projectile.x, projectile.y);
        projectile.destroy();
        continue;
      }
      if (projectile.x < inset || projectile.x > this.arenaSize - inset || projectile.y < inset || projectile.y > this.arenaSize - inset) {
        if (projectile.kind === 'fireball') this.explodeFireball(projectile);
        if (projectile.kind === 'bottle') this.spawnSlime(projectile.owner, projectile.x, projectile.y);
        if (projectile.kind === 'shuriken' && projectile.canBounce()) {
          const vx = (projectile.sprite.body as MatterJS.BodyType).velocity.x;
          const vy = (projectile.sprite.body as MatterJS.BodyType).velocity.y;
          if (projectile.x < inset || projectile.x > this.arenaSize - inset) projectile.sprite.setVelocity(-vx, vy);
          else projectile.sprite.setVelocity(vx, -vy);
          projectile.bounce();
        } else projectile.destroy();
        continue;
      }
      let blocked = false;
      for (const defender of this.aliveFighters()) {
        if (defender === projectile.owner || now - projectile.lastDeflectedAt < 130) continue;
        if (['unarmed', 'crusher', 'orbit'].includes(defender.selection.weapon)) continue;
        if (projectile.kind === 'fireball' && defender.selection.weapon !== 'shield') continue;
        const segment = defender.weapon.segment();
        const blockDistance = defender.selection.weapon === 'shield'
          ? SHIELD.thickness + projectile.hitRadius
          : Math.sqrt(110);
        if (pointToSegmentDistanceSquared(projectile, segment) > blockDistance ** 2) continue;
        if (defender.selection.weapon === 'shield') {
          this.applyReflectedDamage(defender, projectile.owner, projectile.damage, projectile.x, projectile.y);
          projectile.destroy();
          blocked = true;
          break;
        }
        projectile.deflect(defender.weapon.angle + Math.PI / 2, now);
        const progression = defender.weapon.parry();
        if (progression) this.showWeaponProgress(defender, progression);
        this.spark(projectile.x, projectile.y, 0xd9e6ff, 4);
        this.audio.parry();
        blocked = true;
        break;
      }
      if (blocked) continue;
      for (const target of this.aliveFighters()) {
        if (target === projectile.owner) continue;
        if (Phaser.Math.Distance.Squared(projectile.x, projectile.y, target.x, target.y) > (target.radius + projectile.hitRadius) ** 2) continue;
        if (projectile.kind === 'fireball') {
          this.explodeFireball(projectile);
        } else if (projectile.kind === 'bottle') {
          this.spawnSlime(projectile.owner, projectile.x, projectile.y);
        } else if (projectile.kind === 'bolt') {
          this.applyTurretDamage(projectile.owner, target, projectile.damage, projectile.x, projectile.y);
        } else {
          this.applyDamage(projectile.owner, target, projectile.damage, 0.8, projectile.x, projectile.y);
        }
        projectile.destroy();
        break;
      }
    }
    this.projectiles = this.projectiles.filter((projectile) => projectile.alive);
  }

  private spawnSlime(owner: Combatant, x: number, y: number): void {
    const inset = this.arenaInset + SLIME.radius;
    const safeX = Phaser.Math.Clamp(x, inset, this.arenaSize - inset);
    const safeY = Phaser.Math.Clamp(y, inset, this.arenaSize - inset);
    const sprite = this.add.circle(safeX, safeY, SLIME.radius, 0x4fd65f, 0.3)
      .setStrokeStyle(3, 0x9eff80, 0.62).setDepth(2);
    this.slimeZones.push({
      owner, sprite, dps: SLIME.baseDps,
      expiresAt: this.time.now + SLIME.lifetimeMs,
      nextTickAt: this.time.now + SLIME.tickMs,
      nextGrowthAt: this.time.now + SLIME.growthIntervalMs,
    });
    this.spark(safeX, safeY, 0x68e072, 10);
  }

  private updateSlimeZones(now: number): void {
    for (const zone of this.slimeZones) {
      if (now >= zone.expiresAt) { zone.sprite.destroy(); continue; }
      const occupants = this.aliveFighters().filter((fighter) => fighter !== zone.owner
        && Phaser.Math.Distance.Squared(fighter.x, fighter.y, zone.sprite.x, zone.sprite.y) <= (SLIME.radius + fighter.radius) ** 2);
      if (occupants.length === 0) continue;
      if (now >= zone.nextGrowthAt) {
        zone.dps = growSlimeDps(zone.dps, true, SLIME.dpsGrowth);
        zone.nextGrowthAt = now + SLIME.growthIntervalMs;
        zone.sprite.setAlpha(Math.min(0.65, 0.3 + zone.dps * 0.035));
      }
      if (now < zone.nextTickAt) continue;
      zone.nextTickAt = now + SLIME.tickMs;
      for (const target of occupants) {
        const applied = target.damage(zone.dps * SLIME.tickMs / 1_000);
        if (applied <= 0) continue;
        this.floatText(target.x, target.y - 25, `−${applied.toFixed(1)}`, '#8cff79', true);
        if (target.health <= 0) this.eliminate(target, zone.owner);
      }
      this.emitHud(true);
    }
    this.slimeZones = this.slimeZones.filter((zone) => now < zone.expiresAt);
  }

  private applyKatanaStrike(attacker: Combatant, target: Combatant, impactX: number, impactY: number): void {
    if (!attacker.alive || !target.alive || this.ending) return;
    const cuts = attacker.weapon.cutCount;
    const progression = attacker.weapon.registerHit();
    const angle = Math.atan2(target.y - attacker.y, target.x - attacker.x);
    this.addVelocity(target, angle, 0.7);
    this.spark(impactX, impactY, attacker.visualColor, 9);
    this.showWeaponProgress(attacker, progression);
    gameEvents.emit('battle:event', {
      kind: 'hit', title: `${attacker.displayName} DESENVAINA`,
      detail: `${cuts} ${cuts === 1 ? 'corte' : 'cortes'} de ${KATANA.cutDamage} de daño`,
    });
    for (let index = 0; index < cuts; index += 1) {
      this.time.delayedCall((index + 1) * KATANA.cutSpacingMs, () => {
        this.applyKatanaCut(attacker, target);
      });
    }
  }

  private applyKatanaCut(attacker: Combatant, target: Combatant): void {
    if (!target.alive || this.ending) return;
    const damage = KATANA.cutDamage * (this.suddenDeath ? 2 : 1);
    const applied = target.damage(damage);
    const slashAngle = this.random.between(-1.2, 1.2);
    const slash = this.add.graphics().setPosition(target.x, target.y).setRotation(slashAngle).setDepth(18);
    slash.lineStyle(4, 0xff6cb4, 0.95).beginPath().moveTo(-25, 0).lineTo(25, 0).strokePath();
    this.tweens.add({
      targets: slash, alpha: 0, scaleX: 1.35, duration: 190, ease: 'Quad.easeOut',
      onComplete: () => slash.destroy(),
    });
    this.audio.impact(0.35);
    this.floatText(target.x, target.y - 28, `−${Math.round(applied)}`, '#ffb4d8', true);
    this.emitHud(true);
    if (target.health <= 0) this.eliminate(target, attacker);
  }

  private applyTurretDamage(owner: Combatant, target: Combatant, baseDamage: number, impactX: number, impactY: number): void {
    if (!target.alive || this.ending) return;
    const damage = baseDamage * (this.suddenDeath ? 2 : 1);
    const applied = target.damage(damage);
    const angle = Math.atan2(target.y - impactY, target.x - impactX);
    this.addVelocity(target, angle, 0.75);
    this.audio.impact(0.45);
    this.spark(impactX, impactY, 0x92ddff, 7);
    this.floatText(target.x, target.y - 28, `−${Math.round(applied)}`, '#b9ecff');
    gameEvents.emit('battle:event', {
      kind: 'hit', title: `TORRETA DE ${owner.displayName}`,
      detail: `${Math.round(applied)} de daño`,
    });
    this.emitHud(true);
    if (target.health <= 0) this.eliminate(target, owner);
  }

  private showWeaponProgress(fighter: Combatant, progression: string): void {
    if (!fighter.alive) return;
    this.floatText(fighter.x, fighter.y - 40, `↑ ${progression}`, fighter.visualColorCss, true);
    this.emitHud(true);
  }

  private applyDamage(attacker: Combatant, target: Combatant, baseDamage: number, knockback: number, impactX: number, impactY: number, registerProgress = true): void {
    if (!attacker.alive || !target.alive || this.ending) return;
    const damage = baseDamage * (this.suddenDeath ? 2 : 1);
    const applied = target.damage(damage);
    if (applied <= 0) return;
    const angle = Math.atan2(target.y - attacker.y, target.x - attacker.x);
    this.addVelocity(target, angle, knockback);
    const progression = registerProgress ? attacker.weapon.registerHit() : attacker.weapon.progressionText;
    if (registerProgress && attacker.selection.weapon === 'wrench') this.spawnTurret(attacker);
    if (registerProgress && canCreateClone(attacker)) this.spawnClone(attacker, target);
    if (registerProgress && attacker.selection.weapon === 'scepter') attacker.heal(attacker.weapon.healthGain, true);
    this.audio.impact(Math.min(3, damage / 7));
    this.spark(impactX, impactY, attacker.visualColor, 9);
    this.floatText(target.x, target.y - 28, `−${Math.round(applied)}`, '#ffffff');
    if (registerProgress) this.floatText(attacker.x, attacker.y - 40, `↑ ${progression}`, attacker.visualColorCss, true);
    gameEvents.emit('battle:event', {
      kind: 'hit', title: `${attacker.displayName} IMPACTA`,
      detail: `${Math.round(applied)} de daño · ${progression}`,
    });
    this.emitHud(true);
    if (target.health <= 0) this.eliminate(target, attacker);
  }

  private spawnClone(source: Combatant, target: Combatant): void {
    if (!canCreateClone(source)) return;
    const cloneNumber = (this.cloneCountsByOwner.get(source.id) ?? 0) + 1;
    this.cloneCountsByOwner.set(source.id, cloneNumber);
    const cloneHealth = cloneHealthForNumber(cloneNumber);
    const cloneRadius = 18;
    const spawn = this.findCloneSpawnPosition(source, cloneRadius, cloneNumber);
    const { gameplaySelection: cloneSelection, visualSelection: cloneVisualSelection } = createCloneIdentity(
      target.selection, source.visualSelection, cloneNumber,
    );
    const clone = new Combatant(
      this, cloneSelection, this.nextEntitySequence++, spawn.x, spawn.y, cloneHealth, spawn.angle,
      {
        radius: cloneRadius, isClone: true, canClone: false, cloneOwnerId: source.id, generation: 1,
        visualSelection: cloneVisualSelection, visualWeaponType: 'grimoire',
      },
    );
    clone.weapon.copyGameplayProgressFrom(target.weapon);
    const targetBody = target.orb.body as MatterJS.BodyType;
    const inheritedSpeed = Phaser.Math.Clamp(Math.hypot(targetBody.velocity.x, targetBody.velocity.y), ARENA.minSpeed, ARENA.maxSpeed);
    clone.orb.setVelocity(Math.cos(spawn.angle) * inheritedSpeed, Math.sin(spawn.angle) * inheritedSpeed);
    this.fighters.push(clone);
    if (clone.selection.weapon === 'joust') this.scheduleNextJoust(clone, this.time.now);
    this.spark(clone.x, clone.y, source.visualColor, 12);
    gameEvents.emit('battle:event', { kind: 'hit', title: `${source.displayName} CREA CLON`, detail: `${cloneHealth} de vida · habilidades de ${target.displayName}` });
    this.emitHud(true);
  }

  private findCloneSpawnPosition(source: Combatant, cloneRadius: number, cloneNumber: number): { x: number; y: number; angle: number } {
    const inset = this.arenaInset + cloneRadius + 3;
    const baseAngle = (cloneNumber * 2.39996) % (Math.PI * 2);
    let best = { x: source.x, y: source.y, angle: baseAngle, clearance: -Infinity };
    for (let ring = 0; ring < 3; ring += 1) {
      const distance = source.radius + cloneRadius + 14 + ring * 18;
      for (let step = 0; step < 16; step += 1) {
        const angle = baseAngle + step * Math.PI * 2 / 16;
        const x = Phaser.Math.Clamp(source.x + Math.cos(angle) * distance, inset, this.arenaSize - inset);
        const y = Phaser.Math.Clamp(source.y + Math.sin(angle) * distance, inset, this.arenaSize - inset);
        const clearance = this.aliveFighters().reduce((minimum, fighter) => {
          const required = cloneRadius + fighter.radius + 6;
          return Math.min(minimum, Phaser.Math.Distance.Between(x, y, fighter.x, fighter.y) - required);
        }, Infinity);
        if (clearance > best.clearance) best = { x, y, angle, clearance };
        if (clearance >= 0) return { x, y, angle };
      }
    }
    return { x: best.x, y: best.y, angle: best.angle };
  }

  private applyReflectedDamage(defender: Combatant, attacker: Combatant, baseDamage: number, impactX: number, impactY: number): void {
    if (!defender.alive || this.ending) return;
    const damage = baseDamage * (this.suddenDeath ? 2 : 1);
    const applied = attacker.alive ? attacker.damage(damage) : 0;
    if (attacker.alive) {
      const angle = Math.atan2(attacker.y - defender.y, attacker.x - defender.x);
      this.addVelocity(attacker, angle, 1.4);
    }
    const progression = defender.weapon.registerHit();
    this.audio.parry();
    this.spark(impactX, impactY, defender.visualColor, 12);
    if (attacker.alive) {
      this.floatText(attacker.x, attacker.y - 28, `↩ −${Math.round(applied)}`, defender.visualColorCss);
    }
    this.floatText(defender.x, defender.y - 40, `↑ ${progression}`, defender.visualColorCss, true);
    gameEvents.emit('battle:event', {
      kind: 'parry', title: `${defender.displayName} REFLEJA`,
      detail: attacker.alive
        ? `${Math.round(applied)} de daño devuelto · ${progression}`
        : `Proyectil bloqueado · ${progression}`,
    });
    this.emitHud(true);
    if (attacker.alive && attacker.health <= 0) this.eliminate(attacker, defender);
  }

  private explodeFireball(projectile: Projectile): void {
    const radius = fireballExplosionRadius(projectile.explosionSize);
    const wave = this.add.circle(projectile.x, projectile.y, radius, 0xff6a32, 0.2).setDepth(17).setScale(0.25);
    this.tweens.add({
      targets: wave, scale: 1, alpha: 0, duration: 320, ease: 'Quad.easeOut',
      onComplete: () => wave.destroy(),
    });
    this.spark(projectile.x, projectile.y, 0xff8a45, 18);
    for (const target of this.aliveFighters()) {
      if (target === projectile.owner) continue;
      const hitRadius = radius + target.radius;
      if (Phaser.Math.Distance.Squared(projectile.x, projectile.y, target.x, target.y) > hitRadius ** 2) continue;
      this.applyDamage(projectile.owner, target, projectile.damage, 1.05, projectile.x, projectile.y);
    }
  }

  private applyPoison(attacker: Combatant, target: Combatant): void {
    const stacks = target.addPoison(1);
    const current = this.poisonEffects.get(target.id);
    this.poisonEffects.set(target.id, {
      source: attacker,
      nextTickAt: current?.nextTickAt ?? this.time.now + 1_000,
    });
    this.floatText(target.x, target.y - 42, `☠ VENENO ${stacks}`, attacker.visualColorCss, true);
    gameEvents.emit('battle:event', {
      kind: 'hit', title: `${attacker.displayName} ENVENENA`, detail: `${target.displayName} acumula ${stacks}`,
    });
    this.emitHud(true);
  }

  private updatePoison(now: number): void {
    for (const [targetId, effect] of this.poisonEffects) {
      const target = this.fighters.find((fighter) => fighter.id === targetId && fighter.alive);
      if (!target) {
        this.poisonEffects.delete(targetId);
        continue;
      }
      if (now < effect.nextTickAt) continue;
      effect.nextTickAt = now + 1_000;
      const damage = target.poisonStacks * (this.suddenDeath ? 2 : 1);
      const applied = target.damage(damage);
      this.audio.impact(Math.min(2, damage / 6));
      this.spark(target.x, target.y, 0x91e34f, 6);
      this.floatText(target.x, target.y - 30, `☠ −${Math.round(applied)}`, '#b8ff7c');
      gameEvents.emit('battle:event', {
        kind: 'hit', title: 'VENENO', detail: `${target.displayName} pierde ${Math.round(applied)} de vida`,
      });
      this.emitHud(true);
      if (target.health <= 0) {
        this.eliminate(target, effect.source);
        if (this.ending) return;
      }
    }
  }

  private eliminate(target: Combatant, attacker: Combatant): void {
    const lastStanding = this.aliveFighters().length === 2;
    if (lastStanding) {
      this.ending = true;
      this.matter.world.engine.timing.timeScale = 0.2;
      this.time.timeScale = 0.35;
      this.tweens.timeScale = 0.45;
    }
    const { x, y } = target;
    this.poisonEffects.delete(target.id);
    this.nextShotAt.delete(target.id);
    this.joustNextCharge.delete(target.id);
    this.joustCharging.delete(target.id);
    this.joustChargeAngles.delete(target.id);
    target.setInvulnerable(false);
    this.lastBounceHealAt.delete(target.id);
    this.cooldowns.clearFor(target.id);
    target.eliminate();
    if (target.isClone) this.fighters = this.fighters.filter((fighter) => fighter !== target);
    this.audio.elimination();
    this.cameras.main.shake(lastStanding ? 420 : 180, lastStanding ? 0.012 : 0.006);
    this.spark(x, y, target.visualColor, lastStanding ? 28 : 16);
    gameEvents.emit('battle:event', { kind: 'elimination', title: `${target.displayName} ELIMINADO`, detail: `${attacker.displayName} da el golpe final` });
    this.emitHud(true);
    if (!lastStanding) return;
    const winner = this.aliveFighters()[0] as Combatant;
    window.setTimeout(() => {
      this.matter.world.engine.timing.timeScale = this.simulationSpeed;
      this.time.timeScale = this.simulationSpeed;
      this.tweens.timeScale = this.simulationSpeed;
      this.audio.victory();
      gameEvents.emit('battle:ended', { winner: winner.hudState(), weapon: winner.selection.weapon, seed: this.battleConfig.seed });
    }, 850);
  }

  private onCollisionStart(event: CollisionEvent): void {
    if (this.ending) return;
    for (const pair of event.pairs) {
      this.stopJoustOnObstacle(pair.bodyA, pair.bodyB);
      this.stopJoustOnObstacle(pair.bodyB, pair.bodyA);
      this.registerCrossoverTurretBounce(pair.bodyA, pair.bodyB);
      this.registerCrossoverTurretBounce(pair.bodyB, pair.bodyA);
      const first = this.fighters.find((candidate) => candidate.id === pair.bodyA.label && candidate.alive);
      const second = this.fighters.find((candidate) => candidate.id === pair.bodyB.label && candidate.alive);
      if (first && second) {
        this.applyUnarmedImpact(first, second, pair.bodyA);
        this.applyUnarmedImpact(second, first, pair.bodyB);
        this.applyCrusherImpact(first, second);
        this.applyCrusherImpact(second, first);
      }
      if (!this.bounceHealing) continue;
      for (const body of [pair.bodyA, pair.bodyB]) {
        const fighter = this.fighters.find((candidate) => candidate.id === body.label && candidate.alive);
        if (!fighter || this.time.now - (this.lastBounceHealAt.get(fighter.id) ?? -Infinity) < 700) continue;
        if (this.random.next() > 0.28) continue;
        const healed = fighter.heal(4);
        if (healed <= 0) continue;
        this.lastBounceHealAt.set(fighter.id, this.time.now);
        this.floatText(fighter.x, fighter.y - 30, `+${healed}`, '#5de39d');
        this.emitHud(true);
      }
    }
  }

  private registerCrossoverTurretBounce(fighterBody: MatterJS.BodyType, obstacleBody: MatterJS.BodyType): void {
    const obstacleLabel = obstacleBody.label ?? '';
    if (!obstacleLabel.startsWith('turret-')) return;
    const fighter = this.fighters.find((candidate) => candidate.id === fighterBody.label && candidate.alive);
    if (fighter) this.registerCrossoverProgress(fighter);
  }

  private registerCrossoverProgress(fighter: Combatant): void {
    if (!['crusher', 'orbit'].includes(fighter.selection.weapon)) return;
    const progression = fighter.weapon.registerObstacleBounce();
    this.spark(fighter.x, fighter.y, fighter.visualColor, 5);
    this.floatText(fighter.x, fighter.y - 40, `↑ ${progression}`, fighter.visualColorCss, true);
    this.emitHud(true);
  }

  private stopJoustOnObstacle(fighterBody: MatterJS.BodyType, obstacleBody: MatterJS.BodyType): void {
    const obstacleLabel = obstacleBody.label ?? '';
    if (obstacleLabel !== 'arena-wall' && !obstacleLabel.startsWith('turret-')) return;
    const fighter = this.fighters.find((candidate) => candidate.id === fighterBody.label && candidate.alive);
    if (fighter) this.stopJoustCharge(fighter);
  }

  private applyUnarmedImpact(attacker: Combatant, target: Combatant, body: MatterJS.BodyType): void {
    if (attacker.selection.weapon !== 'unarmed' || !attacker.alive || !target.alive) return;
    if (!this.cooldowns.canTrigger(`impact-${attacker.id}`, target.id, this.time.now, UNARMED.hitCooldownMs)) return;
    const speed = Math.hypot(body.velocity.x, body.velocity.y);
    if (speed <= 0.05) return;
    this.applyDamage(attacker, target, speed, 1.35, target.x, target.y);
  }

  private applyCrusherImpact(attacker: Combatant, target: Combatant): void {
    if (attacker.selection.weapon !== 'crusher' || !attacker.alive || !target.alive) return;
    if (!this.cooldowns.canTrigger(`crusher-${attacker.id}`, target.id, this.time.now, CROSSOVER.bodyHitCooldownMs)) return;
    this.applyDamage(attacker, target, attacker.weapon.damage, 1.45, target.x, target.y, false);
  }

  private resolveWallContacts(): void {
    for (const fighter of this.aliveFighters()) {
      const body = fighter.orb.body as MatterJS.BodyType;
      const correction = resolveArenaWallContact(
        fighter.x,
        fighter.y,
        body.velocity,
        this.arenaInset,
        this.arenaSize,
        this.arenaSize,
        fighter.radius,
        fighter.selection.weapon === 'unarmed' ? 0.25 : ARENA.minSpeed * this.globalSpeed,
      );
      if (!correction.corrected) continue;
      fighter.orb.setPosition(correction.x, correction.y);
      fighter.orb.setVelocity(correction.velocity.x, correction.velocity.y);
      this.registerCrossoverProgress(fighter);
    }
  }

  private preventEndlessBattle(elapsed: number): void {
    if (elapsed >= ARENA.battleLimitMs && !this.suddenDeath) {
      this.announceChaos('TIEMPO AGOTADO', 'Muerte súbita activada');
      this.activateSuddenDeath();
    }
    if (elapsed >= this.nextShrinkAt) {
      this.nextShrinkAt += 8_000;
      this.shrinkArena(12);
    }
  }

  private addVelocity(fighter: Combatant, angle: number, amount: number): void {
    const body = fighter.orb.body as MatterJS.BodyType;
    fighter.orb.setVelocity(body.velocity.x + Math.cos(angle) * amount, body.velocity.y + Math.sin(angle) * amount);
  }

  private steerTowardRivals(deltaSeconds: number): void {
    for (const fighter of this.aliveFighters()) {
      const target = this.nearestRival(fighter);
      if (!target) continue;
      const angle = Math.atan2(target.y - fighter.y, target.x - fighter.x);
      this.addVelocity(fighter, angle, 0.62 * deltaSeconds);
    }
  }

  private nearestRival(fighter: Combatant): Combatant | undefined {
    return this.aliveFighters()
      .filter((candidate) => candidate !== fighter)
      .sort((first, second) =>
        Phaser.Math.Distance.Squared(fighter.x, fighter.y, first.x, first.y)
        - Phaser.Math.Distance.Squared(fighter.x, fighter.y, second.x, second.y),
      )[0];
  }

  private aliveFighters(): Combatant[] {
    return this.fighters.filter((fighter) => fighter.alive);
  }

  private emitHud(force = false): void {
    if (!force && this.time.now < this.nextHudAt) return;
    this.nextHudAt = this.time.now + 100;
    gameEvents.emit('battle:hud', this.fighters.map((fighter) => fighter.hudState()));
  }

  private floatText(x: number, y: number, text: string, color: string, compact = false): void {
    const label = this.add.text(x, y, text, {
      fontFamily: 'ui-monospace, monospace', fontSize: compact ? '11px' : '17px', fontStyle: 'bold', color,
      stroke: '#080a10', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(20);
    this.tweens.add({ targets: label, y: y - 38, alpha: 0, duration: compact ? 700 : 520, ease: 'Cubic.easeOut', onComplete: () => label.destroy() });
  }

  private spark(x: number, y: number, color: number, count: number): void {
    if (!this.particlesEnabled) return;
    for (let index = 0; index < count; index += 1) {
      const angle = this.random.between(0, Math.PI * 2);
      const distance = this.random.between(20, 65);
      const particle = this.add.circle(x, y, this.random.between(1.5, 3.5), color, 0.9).setDepth(19);
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.2,
        duration: this.random.between(220, 520),
        ease: 'Quad.easeOut',
        onComplete: () => particle.destroy(),
      });
    }
  }
}
