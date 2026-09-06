import Phaser from 'phaser';

export const gameEvents = new Phaser.Events.EventEmitter();

export interface FighterHudState {
  team?: 'A' | 'B';
  id: string;
  name: string;
  weaponName: string;
  ability: string;
  colorCss: string;
  health: number;
  maxHealth: number;
  alive: boolean;
  stat: string;
}
