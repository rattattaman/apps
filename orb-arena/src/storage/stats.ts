import type { WeaponType } from '../types';

const STORAGE_KEY = 'orb-arena-stats-v1';

export interface ArenaStats {
  battles: number;
  victories: number;
  weaponWins: Record<WeaponType, number>;
}

const EMPTY_STATS: ArenaStats = {
  battles: 0,
  victories: 0,
  weaponWins: { sword: 0, dagger: 0, spear: 0, bow: 0, wand: 0, shield: 0, scythe: 0, unarmed: 0 },
};

export function loadStats(): ArenaStats {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<ArenaStats> | null;
    if (!parsed) return structuredClone(EMPTY_STATS);
    return {
      battles: Number(parsed.battles) || 0,
      victories: Number(parsed.victories) || 0,
      weaponWins: { ...EMPTY_STATS.weaponWins, ...parsed.weaponWins },
    };
  } catch {
    return structuredClone(EMPTY_STATS);
  }
}

export function recordBattle(winnerWeapon: WeaponType): ArenaStats {
  const stats = loadStats();
  stats.battles += 1;
  stats.victories += 1;
  stats.weaponWins[winnerWeapon] += 1;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stats)); } catch { /* Private mode. */ }
  return stats;
}
