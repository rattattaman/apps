import type { FighterSelection, WeaponDefinition, WeaponType } from '../types';

export const ARENA = {
  width: 820,
  height: 820,
  padding: 34,
  orbRadius: 29,
  minSpeed: 2.9,
  maxSpeed: 8.8,
  weaponHitCooldownMs: 420,
  parryCooldownMs: 240,
  battleLimitMs: 120_000,
} as const;

export function arenaSizeForFighterCount(count: number): number {
  if (count <= 2) return 600;
  if (count === 3) return 710;
  if (count === 4) return ARENA.width;
  if (count === 5) return 920;
  if (count === 6) return 1020;
  if (count === 7) return 1120;
  return 1220;
}

export const PROJECTILES = {
  speed: 9.2,
  lifetimeMs: 4_000,
  radius: 6,
  fireIntervalMs: 2_650,
  burstSpacingMs: 80,
  burstAngleSpacing: 0.045,
  maxBurstSpread: 0.32,
  maxBurst: 18,
} as const;

export const FIREBALL = {
  speed: 7.4,
  radius: 10,
  fireIntervalMs: 2_450,
  baseExplosionRadius: 70,
  explosionRadiusGrowth: 14,
} as const;

export const SHIELD = {
  baseWidth: 64,
  widthGrowth: 12,
  thickness: 11,
} as const;

export const UNARMED = {
  initialMaxSpeed: 3,
  maxSpeedGrowth: 0.5,
  gravityForce: 0.00055,
  hitCooldownMs: 360,
} as const;

export function fireballExplosionRadius(size: number): number {
  return FIREBALL.baseExplosionRadius + Math.max(0, size - 1) * FIREBALL.explosionRadiusGrowth;
}

export function shieldWidthForSize(size: number): number {
  return SHIELD.baseWidth + Math.max(0, size - 1) * SHIELD.widthGrowth;
}

export const CHAOS = {
  firstEventMs: 9_000,
  eventIntervalMs: 10_500,
  temporaryDurationMs: 7_000,
  maxArenaInset: 128,
} as const;

export const WEAPONS: Record<WeaponType, WeaponDefinition> = {
  sword: {
    type: 'sword', name: 'Espada', glyph: '╱', color: 0xf6c453,
    ability: 'Cada impacto suma +1 de daño', damage: 1, range: 62, angularSpeed: 3.25,
  },
  dagger: {
    type: 'dagger', name: 'Daga', glyph: '⌁', color: 0xf05a67,
    ability: 'Gana +1,5 de giro tras cada impacto', damage: 1, range: 26, angularSpeed: 5.4,
  },
  spear: {
    type: 'spear', name: 'Lanza', glyph: '⟶', color: 0x68d7ff,
    ability: 'Gana +0,5 de daño y +3 de alcance', damage: 1, range: 88, angularSpeed: 2.55,
  },
  bow: {
    type: 'bow', name: 'Arco', glyph: '❯', color: 0xb882ff,
    ability: 'Empieza con 3 flechas y añade una por impacto', damage: 1, range: 58, angularSpeed: 3, initialBurstSize: 3,
  },
  wand: {
    type: 'wand', name: 'Varita', glyph: '✦', color: 0xff7a3d,
    ability: 'Cada daño suma +1 de daño y explosión', damage: 1, range: 54, angularSpeed: 3.35, initialExplosionSize: 1,
  },
  shield: {
    type: 'shield', name: 'Escudo', glyph: '◖', color: 0x5de3a1,
    ability: 'Refleja el daño y se ensancha al bloquear', damage: 0, range: 38, angularSpeed: 2.7, initialShieldSize: 1,
  },
  scythe: {
    type: 'scythe', name: 'Guadaña', glyph: '☾', color: 0x9bea55,
    ability: 'Cada golpe añade 1 carga de veneno', damage: 1, range: 76, angularSpeed: 2.85,
  },
  unarmed: {
    type: 'unarmed', name: 'Desarmado', glyph: '●', color: 0xe7edf5,
    ability: 'Daño igual a velocidad · máximo +0,5 por golpe', damage: 0, range: 0, angularSpeed: 0,
    initialMaxSpeed: UNARMED.initialMaxSpeed,
  },
};

export const DEFAULT_FIGHTERS: FighterSelection[] = [
  { name: 'SOL', weapon: 'sword', color: 0xffbf43, colorCss: '#ffbf43' },
  { name: 'FURIA', weapon: 'dagger', color: 0xf34f64, colorCss: '#f34f64' },
  { name: 'NEXO', weapon: 'spear', color: 0x3ac7eb, colorCss: '#3ac7eb' },
  { name: 'VANTA', weapon: 'bow', color: 0x9d70f8, colorCss: '#9d70f8' },
  { name: 'PYRA', weapon: 'wand', color: 0xff743d, colorCss: '#ff743d' },
  { name: 'AEGIS', weapon: 'shield', color: 0x55dda0, colorCss: '#55dda0' },
  { name: 'NOX', weapon: 'scythe', color: 0x91e34f, colorCss: '#91e34f' },
  { name: 'GRAV', weapon: 'unarmed', color: 0xdbe3ef, colorCss: '#dbe3ef' },
];
