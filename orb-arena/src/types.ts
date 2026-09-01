export const WEAPON_TYPES = ['sword', 'dagger', 'spear', 'bow', 'wand', 'shield', 'scythe', 'unarmed'] as const;

export type WeaponType = typeof WEAPON_TYPES[number];

export interface FighterSelection {
  name: string;
  weapon: WeaponType;
  color: number;
  colorCss: string;
}

export interface BattleConfig {
  seed: string;
  startingHealth: number;
  chaosMode: boolean;
  fighters: FighterSelection[];
}

export interface WeaponDefinition {
  type: WeaponType;
  name: string;
  ability: string;
  damage: number;
  range: number;
  angularSpeed: number;
  initialBurstSize?: number;
  initialExplosionSize?: number;
  initialShieldSize?: number;
  initialMaxSpeed?: number;
  color: number;
  glyph: string;
}
