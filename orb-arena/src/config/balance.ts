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
  if (count === 8) return 1220;
  if (count === 9) return 1320;
  return 1420;
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
  initialMaxSpeed: 4.2,
  maxSpeedGrowth: 0.5,
  gravityForce: 0.00045,
  hitCooldownMs: 360,
} as const;

export const TURRET = {
  radius: 25,
  placementDistance: 105,
  angularSpeed: 1.85,
  fireIntervalMs: 1_050,
  projectileDamage: 1,
} as const;

export const KATANA = {
  cutDamage: 1,
  cutSpacingMs: 85,
} as const;
export const JOUST = { minChargeDelayMs: 1_600, maxChargeDelayMs: 4_200, chargeSpeed: 11 } as const;
export const SHURIKEN = { fireIntervalMs: 1_450 } as const;
export const BOTTLE = { fireIntervalMs: 2_250, breakDistance: 235 } as const;
export const SLIME = { radius: 72, lifetimeMs: 7_000, tickMs: 500, growthIntervalMs: 1_000, baseDps: 1, dpsGrowth: 0.2 } as const;
export const HAMMER = { spinAcceleration: 0.85 } as const;
export const CROSSOVER = {
  satelliteRadius: 7,
  satelliteOrbitDistance: 60,
  bodyHitCooldownMs: 360,
  giantRadiusGrowth: 2,
  laserCooldownReductionMs: 50,
  laserMinimumCooldownMs: 150,
  lynaOrbRadius: 7,
  lynaBaseOrbitDistance: 52,
  lynaOrbitGap: 19,
  lynaMinimumAngularSpeed: 1.2,
  lynaMaximumAngularSpeed: 4.4,
  duplicateIntervalMs: 5_000,
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
  wrench: {
    type: 'wrench', name: 'Llave inglesa', glyph: '⌕', color: 0xf0a04b,
    ability: 'Genera una torreta giratoria permanente', damage: 1, range: 55, angularSpeed: 2.9,
  },
  katana: {
    type: 'katana', name: 'Katana', glyph: '⼑', color: 0xff55a6,
    ability: 'Golpes y paradas añaden un corte', damage: 1, range: 70, angularSpeed: 3.35, initialCutCount: 1,
  },
  joust: {
    type: 'joust', name: 'Justa', glyph: '⚔', color: 0xffd166,
    ability: 'Golpea por 1; cada golpe suma +2 a su embestida inmortal', damage: 1, range: 78, angularSpeed: 2.8, initialChargeDamage: 1,
  },
  shuriken: {
    type: 'shuriken', name: 'Shuriken', glyph: '✣', color: 0x91a7ff,
    ability: 'Lanza shurikens parriables; cada impacto suma +0,2 rebotes', damage: 1, range: 52, angularSpeed: 3.6, initialShurikenBounces: 1,
  },
  grimoire: {
    type: 'grimoire', name: 'Grimorio', glyph: '▣', color: 0xc58cff,
    ability: 'Crea clones con estadísticas del rival; cada clon nace con 2 vidas más', damage: 1, range: 66, angularSpeed: 2.9,
  },
  scepter: {
    type: 'scepter', name: 'Cetro', glyph: '♜', color: 0xffd36b,
    ability: 'Cada golpe daña y cura; la ganancia aumenta +0,5', damage: 1, range: 58, angularSpeed: 3.1, initialHealthGain: 1,
  },
  bottle: {
    type: 'bottle', name: 'Frasco', glyph: '⚗', color: 0x68e072,
    ability: 'Lanza frascos que dejan baba con DPS creciente', damage: 0, range: 52, angularSpeed: 3.15,
  },
  hammer: {
    type: 'hammer', name: 'Martillo', glyph: '┫', color: 0x7fc8ff,
    ability: 'Daño igual al giro actual; el máximo aumenta +1 por golpe', damage: 1, range: 62, angularSpeed: 1, initialMaxAngularSpeed: 3,
  },
  crusher: {
    type: 'crusher', name: 'Aplastador', glyph: '●', color: 0xff8a4c,
    ability: 'Sin arma; cada rebote contra una pared o torreta suma +1 de daño', damage: 1, range: 0, angularSpeed: 0,
  },
  orbit: {
    type: 'orbit', name: 'Órbita', glyph: '⦿', color: 0x59e0ff,
    ability: 'Cada rebote añade una pequeña bola orbital que hace 1 de daño', damage: 0, range: 0, angularSpeed: 2.8, initialSatelliteCount: 0,
  },
  giant: {
    type: 'giant', name: 'Grande', glyph: '⬤', color: 0xe59cff,
    ability: 'Sin arma; hace 1 de daño corporal y cada rebote aumenta su tamaño', damage: 1, range: 0, angularSpeed: 0, initialSizeLevel: 0,
  },
  laser: {
    type: 'laser', name: 'Láser', glyph: '━', color: 0xff5a70,
    ability: 'Rayo de alcance infinito; su recarga disminuye cada vez que golpea', damage: 1, range: 0, angularSpeed: 2.05, initialLaserCooldownMs: 900,
  },
  lyna: {
    type: 'lyna', name: 'Lyna', glyph: '◎', color: 0x78f0c4,
    ability: 'Cada rebote añade un orbe más lejano con velocidad aleatoria', damage: 0, range: 0, angularSpeed: 0, initialLynaOrbCount: 0,
  },
  duplicator: {
    type: 'duplicator', name: 'Duplicador', glyph: '◉', color: 0xffd45a,
    ability: 'Crea copias periódicas; si muere el original, mueren todas', damage: 0, range: 0, angularSpeed: 0,
  },
};

export const SEASON_ONE_FIGHTERS: FighterSelection[] = [
  { name: 'SOL', weapon: 'sword', color: 0xffbf43, colorCss: '#ffbf43', season: 1 },
  { name: 'FURIA', weapon: 'dagger', color: 0xf34f64, colorCss: '#f34f64', season: 1 },
  { name: 'NEXO', weapon: 'spear', color: 0x3ac7eb, colorCss: '#3ac7eb', season: 1 },
  { name: 'VANTA', weapon: 'bow', color: 0x9d70f8, colorCss: '#9d70f8', season: 1 },
  { name: 'PYRA', weapon: 'wand', color: 0xff743d, colorCss: '#ff743d', season: 1 },
  { name: 'AEGIS', weapon: 'shield', color: 0x55dda0, colorCss: '#55dda0', season: 1 },
  { name: 'NOX', weapon: 'scythe', color: 0x91e34f, colorCss: '#91e34f', season: 1 },
  { name: 'GRAV', weapon: 'unarmed', color: 0xdbe3ef, colorCss: '#dbe3ef', season: 1 },
];

export const SEASON_TWO_FIGHTERS: FighterSelection[] = [
  { name: 'TORQ', weapon: 'wrench', color: 0xf0a04b, colorCss: '#f0a04b', season: 2 },
  { name: 'KAGE', weapon: 'katana', color: 0xff55a6, colorCss: '#ff55a6', season: 2 },
  { name: 'LANCE', weapon: 'joust', color: 0xffd166, colorCss: '#ffd166', season: 2 },
  { name: 'SHURI', weapon: 'shuriken', color: 0x91a7ff, colorCss: '#91a7ff', season: 2 },
  { name: 'TOME', weapon: 'grimoire', color: 0xc58cff, colorCss: '#c58cff', season: 2 },
  { name: 'SCEP', weapon: 'scepter', color: 0xffd36b, colorCss: '#ffd36b', season: 2 },
  { name: 'VIAL', weapon: 'bottle', color: 0x68e072, colorCss: '#68e072', season: 2 },
  { name: 'MAUL', weapon: 'hammer', color: 0x7fc8ff, colorCss: '#7fc8ff', season: 2 },
];

export const CROSSOVER_FIGHTERS: FighterSelection[] = [
  { name: 'CRUSH', weapon: 'crusher', color: 0xff8a4c, colorCss: '#ff8a4c', season: 'Crossover' },
  { name: 'ORBITA', weapon: 'orbit', color: 0x59e0ff, colorCss: '#59e0ff', season: 'Crossover' },
  { name: 'GRANDE', weapon: 'giant', color: 0xe59cff, colorCss: '#e59cff', season: 'Crossover' },
  { name: 'LASER', weapon: 'laser', color: 0xff5a70, colorCss: '#ff5a70', season: 'Crossover' },
  { name: 'LYNA', weapon: 'lyna', color: 0x78f0c4, colorCss: '#78f0c4', season: 'Crossover' },
  { name: 'DUPLI', weapon: 'duplicator', color: 0xffd45a, colorCss: '#ffd45a', season: 'Crossover' },
];

export const DEFAULT_FIGHTERS: FighterSelection[] = [...SEASON_ONE_FIGHTERS, ...SEASON_TWO_FIGHTERS, ...CROSSOVER_FIGHTERS];
