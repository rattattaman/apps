import type { FighterSelection, WeaponDefinition, WeaponType } from '../types';

export const ARENA = {
  width: 1120,
  height: 650,
  padding: 34,
  orbRadius: 29,
  minSpeed: 2.9,
  maxSpeed: 8.8,
  weaponHitCooldownMs: 420,
  parryCooldownMs: 240,
  battleLimitMs: 120_000,
} as const;

export const PROJECTILES = {
  speed: 9.2,
  lifetimeMs: 4_000,
  radius: 6,
  fireIntervalMs: 2_650,
  burstSpacingMs: 135,
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
    ability: 'Acelera mucho su giro tras cada impacto', damage: 5, range: 26, angularSpeed: 5.4,
  },
  spear: {
    type: 'spear', name: 'Lanza', glyph: '⟶', color: 0x68d7ff,
    ability: 'Gana +0,5 de daño y +3 de alcance', damage: 1, range: 88, angularSpeed: 2.55,
  },
  bow: {
    type: 'bow', name: 'Arco', glyph: '❯', color: 0xb882ff,
    ability: 'Añade una flecha escalonada por ráfaga', damage: 6, range: 58, angularSpeed: 3,
  },
};

export const DEFAULT_FIGHTERS: FighterSelection[] = [
  { name: 'SOL', weapon: 'sword', color: 0xffbf43, colorCss: '#ffbf43' },
  { name: 'FURIA', weapon: 'dagger', color: 0xf34f64, colorCss: '#f34f64' },
  { name: 'NEXO', weapon: 'spear', color: 0x3ac7eb, colorCss: '#3ac7eb' },
  { name: 'VANTA', weapon: 'bow', color: 0x9d70f8, colorCss: '#9d70f8' },
];
