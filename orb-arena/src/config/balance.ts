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
  return ARENA.width;
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
};

export const DEFAULT_FIGHTERS: FighterSelection[] = [
  { name: 'SOL', weapon: 'sword', color: 0xffbf43, colorCss: '#ffbf43' },
  { name: 'FURIA', weapon: 'dagger', color: 0xf34f64, colorCss: '#f34f64' },
  { name: 'NEXO', weapon: 'spear', color: 0x3ac7eb, colorCss: '#3ac7eb' },
  { name: 'VANTA', weapon: 'bow', color: 0x9d70f8, colorCss: '#9d70f8' },
];
