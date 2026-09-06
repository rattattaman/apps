import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WEAPON_TYPES } from '../types';
import { loadStats, recordBattle } from './stats';

const STORAGE_KEY = 'orb-arena-stats-v1';

describe('battle statistics persistence', () => {
  let entries: Map<string, string>;
  let storage: { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    entries = new Map();
    storage = {
      getItem: vi.fn((key: string) => entries.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { entries.set(key, value); }),
    };
    vi.stubGlobal('localStorage', storage);
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  it('cuenta un empate como batalla sin inventar victorias', () => {
    recordBattle('shield');
    const stats = recordBattle(null);
    expect(stats.battles).toBe(2);
    expect(stats.victories).toBe(1);
    expect(stats.weaponWins.shield).toBe(1);
  });

  it('returns independent empty statistics without writing to storage', () => {
    const first = loadStats();
    expect(first.battles).toBe(0);
    expect(first.victories).toBe(0);
    expect(Object.keys(first.weaponWins)).toEqual([...WEAPON_TYPES]);
    expect(Object.values(first.weaponWins).every((wins) => wins === 0)).toBe(true);
    first.weaponWins.sword = 10;
    expect(loadStats().weaponWins.sword).toBe(0);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('preserves existing v1 totals and fills missing weapons with zero', () => {
    const saved = JSON.stringify({ battles: 37, victories: 37, weaponWins: { sword: 25, bow: 12 } });
    entries.set(STORAGE_KEY, saved);
    const stats = loadStats();
    expect(stats.battles).toBe(37);
    expect(stats.victories).toBe(37);
    expect(stats.weaponWins.sword).toBe(25);
    expect(stats.weaponWins.bow).toBe(12);
    expect(stats.weaponWins.duplicator).toBe(0);
    expect(WEAPON_TYPES.every((weapon) => Number.isFinite(stats.weaponWins[weapon]))).toBe(true);
    expect(entries.get(STORAGE_KEY)).toBe(saved);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('records and reloads wins under the existing storage key without losing totals', () => {
    entries.set(STORAGE_KEY, JSON.stringify({ battles: 4, victories: 4, weaponWins: { sword: 4 } }));
    const result = recordBattle('duplicator');
    expect(result.battles).toBe(5);
    expect(result.victories).toBe(5);
    expect(result.weaponWins.sword).toBe(4);
    expect(result.weaponWins.duplicator).toBe(1);
    expect(storage.setItem).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(result));
    expect(loadStats()).toEqual(result);
    expect(recordBattle('sword').weaponWins.sword).toBe(5);
  });

  it('preserves totals when the saved data has no weaponWins field', () => {
    entries.set(STORAGE_KEY, JSON.stringify({ battles: 9, victories: 9 }));
    const stats = loadStats();
    expect(stats.battles).toBe(9);
    expect(stats.victories).toBe(9);
    expect(Object.values(stats.weaponWins).every((wins) => wins === 0)).toBe(true);
  });

  it('falls back to empty statistics for malformed JSON or unavailable storage', () => {
    entries.set(STORAGE_KEY, '{invalid');
    expect(loadStats().battles).toBe(0);
    storage.getItem.mockImplementationOnce(() => { throw new Error('Storage unavailable'); });
    expect(loadStats().weaponWins.duplicator).toBe(0);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('returns the updated battle result even when writing to storage is unavailable', () => {
    storage.setItem.mockImplementationOnce(() => { throw new Error('Storage unavailable'); });
    const result = recordBattle('bow');
    expect(result.battles).toBe(1);
    expect(result.victories).toBe(1);
    expect(result.weaponWins.bow).toBe(1);
    expect(entries.size).toBe(0);
  });
});
