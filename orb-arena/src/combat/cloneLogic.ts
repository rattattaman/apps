export interface CloneSourceState {
  alive: boolean;
  isClone: boolean;
  canClone: boolean;
}

export function canCreateClone(source: CloneSourceState): boolean {
  return source.alive && source.canClone && !source.isClone;
}

export function cloneHealthForNumber(cloneNumber: number): number {
  return Math.max(1, Math.floor(cloneNumber) * 2);
}

export function createCloneIdentity(
  gameplaySource: FighterSelection,
  grimoireSource: FighterSelection,
  cloneNumber: number,
): { gameplaySelection: FighterSelection; visualSelection: FighterSelection } {
  return {
    gameplaySelection: { ...gameplaySource },
    visualSelection: {
      ...grimoireSource,
      name: `${grimoireSource.name}·${cloneNumber}`,
      weapon: 'grimoire',
    },
  };
}
import type { FighterSelection } from '../types';
