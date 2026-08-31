import Phaser from 'phaser';
import { SoundEngine } from '../audio/SoundEngine';
import { COLLISION, Combatant } from '../combat/Combatant';
import { burstShotDelays, ContactCooldowns } from '../combat/combatLogic';
import { resolveArenaWallContact } from '../combat/physicsLogic';
import { ARENA, arenaSizeForFighterCount, CHAOS, DEFAULT_FIGHTERS, PROJECTILES } from '../config/balance';
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

const PREVIEW_CONFIG: BattleConfig = {
  seed: 'ORB-ARENA', startingHealth: 100, chaosMode: false, fighters: DEFAULT_FIGHTERS,
};

export class BattleScene extends Phaser.Scene implements ChaosHost {
  private fighters: Combatant[] = [];
  private projectiles: Projectile[] = [];
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
  private readonly lastBounceHealAt = new Map<string, number>();
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
    this.steerTowardRivals(deltaSeconds);
    this.updateMeleeCombat(time);
    this.updateParries(time);
    this.updateBows(time);
    this.updateProjectiles(time);
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
    this.nextHudAt = 0;
    this.nextShrinkAt = ARENA.battleLimitMs + 8_000;
    this.nextShotAt.clear();
    this.lastBounceHealAt.clear();
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
      return fighter;
    });
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
        : [{ x: left, y: top }, { x: right, y: top }, { x: left, y: bottom }, { x: right, y: bottom }];
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
    for (const attacker of this.aliveFighters()) {
      if (attacker.selection.weapon === 'bow') continue;
      const segment = attacker.weapon.segment();
      for (const target of this.aliveFighters()) {
        if (target === attacker) continue;
        const hitRadius = ARENA.orbRadius + 7;
        if (pointToSegmentDistanceSquared(target, segment) > hitRadius * hitRadius) continue;
        if (!this.cooldowns.canTrigger(attacker.id, target.id, now, ARENA.weaponHitCooldownMs)) continue;
        const knockback = attacker.selection.weapon === 'spear' ? 2.5 : 1.05;
        this.applyDamage(attacker, target, attacker.weapon.damage, knockback, segment.end.x, segment.end.y);
      }
    }
  }

  private updateParries(now: number): void {
    const alive = this.aliveFighters();
    for (let firstIndex = 0; firstIndex < alive.length; firstIndex += 1) {
      const first = alive[firstIndex] as Combatant;
      for (let secondIndex = firstIndex + 1; secondIndex < alive.length; secondIndex += 1) {
        const second = alive[secondIndex] as Combatant;
        if (segmentDistanceSquared(first.weapon.segment(), second.weapon.segment()) > 100) continue;
        if (!this.cooldowns.canTrigger(`parry-${first.id}`, second.id, now, ARENA.parryCooldownMs)) continue;
        first.weapon.parry();
        second.weapon.parry();
        const angle = Math.atan2(second.y - first.y, second.x - first.x);
        this.addVelocity(first, angle + Math.PI, 0.6);
        this.addVelocity(second, angle, 0.6);
        const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
        this.spark(midpoint.x, midpoint.y, 0xeef6ff, 5);
        this.audio.parry();
        gameEvents.emit('battle:event', { kind: 'parry', title: 'PARADA', detail: `${first.selection.name} ↔ ${second.selection.name}` });
      }
    }
  }

  private updateBows(now: number): void {
    for (const fighter of this.aliveFighters()) {
      if (fighter.selection.weapon !== 'bow') continue;
      if (now < (this.nextShotAt.get(fighter.id) ?? 0)) continue;
      const target = this.nearestRival(fighter);
      if (!target) continue;
      const targetAngle = Math.atan2(target.y - fighter.y, target.x - fighter.x);
      const alignment = Math.abs(Phaser.Math.Angle.Wrap(fighter.weapon.angle - targetAngle));
      if (alignment > 0.42) {
        this.nextShotAt.set(fighter.id, now + 90);
        continue;
      }
      const count = Math.min(PROJECTILES.maxBurst, fighter.weapon.burstSize) * this.projectileMultiplier;
      this.nextShotAt.set(
        fighter.id,
        now + PROJECTILES.fireIntervalMs + Math.max(0, count - 1) * PROJECTILES.burstSpacingMs,
      );
      const spread = count === 1 ? 0 : Math.min(0.72, 0.105 * (count - 1));
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
      if (projectile.x < inset || projectile.x > this.arenaSize - inset || projectile.y < inset || projectile.y > this.arenaSize - inset) {
        projectile.destroy();
        continue;
      }
      let blocked = false;
      for (const defender of this.aliveFighters()) {
        if (defender === projectile.owner || now - projectile.lastDeflectedAt < 130) continue;
        const segment = defender.weapon.segment();
        if (pointToSegmentDistanceSquared(projectile, segment) > 110) continue;
        projectile.deflect(defender.weapon.angle + Math.PI / 2, now);
        defender.weapon.parry();
        this.spark(projectile.x, projectile.y, 0xd9e6ff, 4);
        this.audio.parry();
        blocked = true;
        break;
      }
      if (blocked) continue;
      for (const target of this.aliveFighters()) {
        if (target === projectile.owner) continue;
        if (Phaser.Math.Distance.Squared(projectile.x, projectile.y, target.x, target.y) > (ARENA.orbRadius + PROJECTILES.radius) ** 2) continue;
        this.applyDamage(projectile.owner, target, projectile.damage, 0.8, projectile.x, projectile.y);
        projectile.destroy();
        break;
      }
    }
    this.projectiles = this.projectiles.filter((projectile) => projectile.alive);
  }

  private applyDamage(attacker: Combatant, target: Combatant, baseDamage: number, knockback: number, impactX: number, impactY: number): void {
    if (!attacker.alive || !target.alive || this.ending) return;
    const damage = baseDamage * (this.suddenDeath ? 2 : 1);
    const applied = target.damage(damage);
    const angle = Math.atan2(target.y - attacker.y, target.x - attacker.x);
    this.addVelocity(target, angle, knockback);
    const progression = attacker.weapon.registerHit();
    this.audio.impact(Math.min(3, damage / 7));
    this.spark(impactX, impactY, attacker.selection.color, 9);
    this.floatText(target.x, target.y - 28, `−${Math.round(applied)}`, '#ffffff');
    this.floatText(attacker.x, attacker.y - 40, `↑ ${progression}`, attacker.selection.colorCss, true);
    gameEvents.emit('battle:event', {
      kind: 'hit', title: `${attacker.selection.name} IMPACTA`,
      detail: `${Math.round(applied)} de daño · ${progression}`,
    });
    this.emitHud(true);
    if (target.health <= 0) this.eliminate(target, attacker);
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
    target.eliminate();
    this.audio.elimination();
    this.cameras.main.shake(lastStanding ? 420 : 180, lastStanding ? 0.012 : 0.006);
    this.spark(x, y, target.selection.color, lastStanding ? 28 : 16);
    gameEvents.emit('battle:event', { kind: 'elimination', title: `${target.selection.name} ELIMINADO`, detail: `${attacker.selection.name} da el golpe final` });
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
        ARENA.orbRadius,
        ARENA.minSpeed * this.globalSpeed,
      );
      if (!correction.corrected) continue;
      fighter.orb.setPosition(correction.x, correction.y);
      fighter.orb.setVelocity(correction.velocity.x, correction.velocity.y);
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
